import { CodeDetail } from "../../../../components/CodeDetail";
import { DutyCalculator } from "../../../../components/DutyCalculator";
import { ExportMenu } from "../../../../components/ExportMenu";
import { api } from "../../../../lib/api";

export default async function CodePage({ params }: { params: Promise<{ country: "CN" | "IN" | "AE"; code: string }> }) {
  const { country, code } = await params;
  let data: unknown = null;
  try {
    data = await api.code(country, code);
  } catch {
    data = null;
  }
  return (
    <main style={{ padding: 24 }}>
      <CodeDetail country={country} code={code} />
      <DutyCalculator country={country} hsCode={code} />
      <ExportMenu data={data} />
    </main>
  );
}
