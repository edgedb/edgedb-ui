import {createClient} from "edgedb";

export const client = createClient({port: 5656, tlsSecurity: "insecure"});

export function goToPage(url: string) {
  return driver.get(`http://localhost:3000/ui/${url}`);
}

export function ByUIClass(className: string) {
  return By.css(`[class*=${className}__]`);
}
