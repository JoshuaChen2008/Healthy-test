import type { Metadata } from 'next';

import { QuizFlow } from '@/app/quiz/QuizFlow';

export const metadata: Metadata = {
  title: '健康测评',
  description: '回答 7 个问题，获得你的个人健康方向。',
};

export default function QuizPage(): React.ReactElement {
  return <QuizFlow />;
}
