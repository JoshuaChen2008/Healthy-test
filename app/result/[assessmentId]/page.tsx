import type { Metadata } from 'next';

import { ResultView } from '@/app/result/[assessmentId]/ResultView';

export const metadata: Metadata = {
  title: '你的测评结果',
  description: '查看你的个人健康测评结果与目标方向。',
};

interface ResultPageProps {
  readonly params: Promise<{ readonly assessmentId: string }>;
}

export default async function ResultPage({ params }: ResultPageProps): Promise<React.ReactElement> {
  const { assessmentId } = await params;
  return <ResultView assessmentId={assessmentId} />;
}
