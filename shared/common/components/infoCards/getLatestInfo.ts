import useSWR from "swr";
import {z} from "zod";

const latestInfoUrl =
  (import.meta as any).env?.VITE_LATEST_INFO_URL ||
  "https://www.edgedb.com/latestInfo.json";

const latestInfoType = z.object({
  latestBlogPost: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      publishedTimestamp: z.number(),
      imageUrl: z.string(),
      imageBrightness: z.number(),
    })
  ),
  latestUpdate: z.object({
    title: z.string(),
    url: z.string(),
  }),
  latestEdgeDBVersion: z.string(),
});

export type LatestInfo = z.infer<typeof latestInfoType>;

async function fetchLatestInfo() {
  const res = await fetch(latestInfoUrl);
  if (!res.ok) {
    throw new Error(
      `fetching latest info failed with error: ${res.status} ${res.statusText}`
    );
  }
  try {
    return latestInfoType.parse(await res.json());
  } catch (e) {
    console.error(e);
    throw e;
  }
}

export function useLatestInfo() {
  const {data} = useSWR("_latestInfo", fetchLatestInfo, {
    revalidateOnFocus: false,
  });

  return data;
}
