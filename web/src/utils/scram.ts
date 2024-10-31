// @ts-expect-error No types available
import * as SHA256 from "hash.js/lib/hash/sha/256";
// @ts-expect-error No types available
import * as Hmac from "hash.js/lib/hash/hmac";

import {ProtocolError} from "edgedb";

const AUTH_ENDPOINT = "/auth/token";
const RAW_NONCE_LENGTH = 18;

export async function SCRAMAuth(
  baseUrl: string,
  username: string,
  password: string
): Promise<string> {
  const authUrl = baseUrl + AUTH_ENDPOINT;
  const clientNonce = generateNonce();
  const [clientFirst, clientFirstBare] = buildClientFirstMessage(
    clientNonce,
    username
  );

  const serverFirstRes = await fetch(authUrl, {
    headers: {
      Authorization: `SCRAM-SHA-256 data=${utf8ToB64(clientFirst)}`,
    },
  });
  if (serverFirstRes.status === 403) {
    throw new Error(`Server doesn't support HTTP SCRAM authentication`);
  }
  const firstAttrs = parseHeaders(serverFirstRes.headers, "WWW-Authenticate");
  if (firstAttrs.size === 0) {
    throw new Error("Invalid credentials");
  }
  if (!firstAttrs.has("sid") || !firstAttrs.has("data")) {
    throw new ProtocolError(
      `server response doesn't contain '${
        !firstAttrs.has("sid") ? "sid" : "data"
      }' attribute`
    );
  }
  const sid = firstAttrs.get("sid")!;
  const serverFirst = b64ToUtf8(firstAttrs.get("data")!);

  const [serverNonce, salt, iterCount] = parseServerFirstMessage(serverFirst);

  const [clientFinal, expectedServerSig] = buildClientFinalMessage(
    password,
    salt,
    iterCount,
    clientFirstBare,
    serverFirst,
    serverNonce
  );

  const serverFinalRes = await fetch(authUrl, {
    headers: {
      Authorization: `SCRAM-SHA-256 sid=${sid}, data=${utf8ToB64(
        clientFinal
      )}`,
    },
  });
  if (!serverFinalRes.ok) {
    throw new Error("Invalid credentials");
  }
  const finalAttrs = parseHeaders(
    serverFinalRes.headers,
    "Authentication-Info",
    false
  );
  if (!firstAttrs.has("sid") || !firstAttrs.has("data")) {
    throw new ProtocolError(
      `server response doesn't contain '${
        !firstAttrs.has("sid") ? "sid" : "data"
      }' attribute`
    );
  }
  if (finalAttrs.get("sid") !== sid) {
    throw new ProtocolError("SCRAM session id does not match");
  }
  const serverFinal = b64ToUtf8(finalAttrs.get("data")!);

  const serverSig = parseServerFinalMessage(serverFinal);

  if (!serverSig.equals(expectedServerSig)) {
    throw new ProtocolError("server SCRAM proof does not match");
  }

  const authToken = await serverFinalRes.text();

  return authToken;
}

function parseHeaders(headers: Headers, headerName: string, checkAlgo = true) {
  const header = headers.get(headerName);
  if (!header) {
    throw new ProtocolError(`response doesn't contain '${headerName}' header`);
  }
  let rawAttrs: string;
  if (checkAlgo) {
    const [algo, ..._rawAttrs] = header.split(" ");
    if (algo !== "SCRAM-SHA-256") {
      throw new ProtocolError(`invalid scram algo '${algo}'`);
    }
    rawAttrs = _rawAttrs.join(" ");
  } else {
    rawAttrs = header;
  }
  return new Map(
    rawAttrs
      ? rawAttrs.split(",").map((attr) => {
          const [key, val] = attr.split("=", 2);
          return [key.trim(), val.trim()];
        })
      : []
  );
}

function utf8ToB64(str: string): string {
  return Buffer.from(str, "utf8").toString("base64");
}

function b64ToUtf8(str: string): string {
  return Buffer.from(str, "base64").toString("utf8");
}

function saslprep(str: string): string {
  return str.normalize("NFKC");
}

function randomBytes(size: number): Buffer {
  const buf = new Uint8Array(size);
  const rand = window.crypto.getRandomValues(buf);

  return Buffer.from(rand);
}

function H(msg: Buffer): Buffer {
  const hash = new SHA256();
  hash.update(msg);
  return Buffer.from(hash.digest());
}

function HMAC(key: Buffer, ...msgs: Buffer[]): Buffer {
  const hm = Hmac(SHA256, key);
  for (const msg of msgs) {
    hm.update(msg);
  }
  return Buffer.from(hm.digest());
}

export function generateNonce(length: number = RAW_NONCE_LENGTH): Buffer {
  return randomBytes(length);
}

function buildClientFirstMessage(
  clientNonce: Buffer,
  username: string
): [string, string] {
  const bare = `n=${saslprep(username)},r=${clientNonce.toString("base64")}`;
  return [`n,,${bare}`, bare];
}

function parseServerFirstMessage(msg: string): [Buffer, Buffer, number] {
  const attrs = msg.split(",");

  if (attrs.length < 3) {
    throw new ProtocolError("malformed SCRAM message");
  }

  const nonceAttr = attrs[0];
  if (!nonceAttr || nonceAttr[0] !== "r") {
    throw new ProtocolError("malformed SCRAM message");
  }
  const nonceB64 = nonceAttr.split("=", 2)[1];
  if (!nonceB64) {
    throw new ProtocolError("malformed SCRAM message");
  }
  const nonce = Buffer.from(nonceB64, "base64");

  const saltAttr = attrs[1];
  if (!saltAttr || saltAttr[0] !== "s") {
    throw new ProtocolError("malformed SCRAM message");
  }
  const saltB64 = saltAttr.split("=", 2)[1];
  if (!saltB64) {
    throw new ProtocolError("malformed SCRAM message");
  }
  const salt = Buffer.from(saltB64, "base64");

  const iterAttr = attrs[2];
  if (!iterAttr || iterAttr[0] !== "i") {
    throw new ProtocolError("malformed SCRAM message");
  }
  const iter = iterAttr.split("=", 2)[1];
  if (!iter || !iter.match(/^[0-9]*$/)) {
    throw new ProtocolError("malformed SCRAM message");
  }
  const iterCount = parseInt(iter, 10);
  if (iterCount <= 0) {
    throw new ProtocolError("malformed SCRAM message");
  }

  return [nonce, salt, iterCount];
}

function buildClientFinalMessage(
  password: string,
  salt: Buffer,
  iterations: number,
  clientFirstBare: string,
  serverFirst: string,
  serverNonce: Buffer
): [string, Buffer] {
  const clientFinal = `c=biws,r=${serverNonce.toString("base64")}`;
  const authMessage = Buffer.from(
    `${clientFirstBare},${serverFirst},${clientFinal}`,
    "utf8"
  );
  const saltedPassword = getSaltedPassword(
    Buffer.from(saslprep(password), "utf8"),
    salt,
    iterations
  );
  const clientKey = getClientKey(saltedPassword);
  const storedKey = H(clientKey);
  const clientSignature = HMAC(storedKey, authMessage);
  const clientProof = XOR(clientKey, clientSignature);

  const serverKey = getServerKey(saltedPassword);
  const serverProof = HMAC(serverKey, authMessage);

  return [`${clientFinal},p=${clientProof.toString("base64")}`, serverProof];
}

export function getSaltedPassword(
  password: Buffer,
  salt: Buffer,
  iterations: number
): Buffer {
  let Hi = HMAC(password, salt, Buffer.from("00000001", "hex"));
  let Ui = Hi;

  for (let _ = 0; _ < iterations - 1; _++) {
    Ui = HMAC(password, Ui);
    Hi = XOR(Hi, Ui);
  }

  return Hi;
}

export function getClientKey(saltedPassword: Buffer): Buffer {
  return HMAC(saltedPassword, Buffer.from("Client Key", "utf8"));
}

export function getServerKey(saltedPassword: Buffer): Buffer {
  return HMAC(saltedPassword, Buffer.from("Server Key", "utf8"));
}

export function XOR(a: Buffer, b: Buffer): Buffer {
  const len = a.length;
  if (len !== b.length) {
    throw new ProtocolError("scram.XOR: buffers are of different lengths");
  }
  const res = Buffer.allocUnsafe(len);
  for (let i = 0; i < len; i++) {
    res[i] = a[i] ^ b[i];
  }
  return res;
}

function parseServerFinalMessage(msg: string): Buffer {
  const attrs = msg.split(",");

  if (attrs.length < 1) {
    throw new ProtocolError("malformed SCRAM message");
  }

  const nonceAttr = attrs[0];
  if (!nonceAttr || nonceAttr[0] !== "v") {
    throw new ProtocolError("malformed SCRAM message");
  }
  const signatureB64 = nonceAttr.split("=", 2)[1];
  if (!signatureB64) {
    throw new ProtocolError("malformed SCRAM message");
  }
  const sig = Buffer.from(signatureB64, "base64");
  return sig;
}
