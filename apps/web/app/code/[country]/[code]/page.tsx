import { CodeDetail } from "../../../../components/CodeDetail";
export default async function CodePage({ params }: { params: Promise<{ country: "CN" | "IN"; code: string }> }) {
  const { country, code } = await params;
  return <main style={{ padding: 24 }}><CodeDetail country={country} code={code} /></main>;
}
