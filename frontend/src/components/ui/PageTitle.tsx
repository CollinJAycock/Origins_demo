/** Sets the document title; React 19 hoists <title> into <head>. */
export function PageTitle({ children }: { children: string }) {
  return <title>{`${children} · Event Manager`}</title>
}
