import { GuideExplorer } from '@/components/GuideExplorer';

export const dynamic = 'force-dynamic';

export default function GuidePage() {
  return (
    <>
      <header style={{ marginBottom: 22 }}>
        <p style={{ letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9aa3b5', fontSize: 11, fontWeight: 600, margin: 0 }}>
          Umer AI OS · operating manual
        </p>
        <h1 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.4rem)', fontWeight: 650, margin: '8px 0 0', letterSpacing: '-0.03em' }}>
          Guide & Knowledge Center
        </h1>
        <p style={{ margin: '10px 0 0', color: '#9aa3b5', fontSize: 14, maxWidth: 760, lineHeight: 1.55 }}>
          Understand how the AI company works, how work moves between agents, how MCP and token optimization fit in, and where to inspect the live system.
        </p>
      </header>
      <GuideExplorer />
    </>
  );
}
