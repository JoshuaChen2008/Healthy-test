import Link from 'next/link';

import { BrandMark } from '@/app/components/BrandMark';

export default function Home(): React.ReactElement {
  return (
    <main className="landing-shell">
      <nav className="site-nav" aria-label="主导航">
        <BrandMark />
        <Link className="nav-cta" href="/quiz">
          开始测评
        </Link>
      </nav>

      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow">你的健康，不需要靠猜</span>
          <h1>花 3 分钟，找到更适合你的健康方向</h1>
          <p>
            回答 7 个简单问题，获得体重趋势、每日热量参考和清晰的目标路径。
            不说教，只给你能真正开始的下一步。
          </p>
          <div className="hero-actions">
            <Link className="primary-button primary-button-large" href="/quiz">
              开始免费测评
              <ArrowRightIcon />
            </Link>
            <span className="privacy-note">
              <ShieldIcon /> 数据仅用于生成你的测评结果
            </span>
          </div>
        </div>

        <div className="hero-visual" aria-label="健康测评结果预览">
          <div className="orb orb-one" />
          <div className="orb orb-two" />
          <div className="preview-card">
            <div className="preview-header">
              <span>今日健康方向</span>
              <span className="status-pill">已完成</span>
            </div>
            <div className="score-ring" aria-label="健康方向指数 82">
              <span>82</span>
              <small>方向指数</small>
            </div>
            <div className="preview-metrics">
              <div>
                <span>节奏</span>
                <strong>稳步调整</strong>
              </div>
              <div>
                <span>重点</span>
                <strong>建立习惯</strong>
              </div>
            </div>
            <div className="mini-progress"><span /></div>
            <p>你已经有一个可实现的起点。</p>
          </div>
        </div>
      </section>

      <section className="trust-strip" aria-label="产品特点">
        <TrustItem icon={<ClockIcon />} title="约 3 分钟" detail="7 个核心问题" />
        <TrustItem icon={<CompassIcon />} title="即时生成" detail="无需等待报告" />
        <TrustItem icon={<LockIcon />} title="私密保存" detail="严格校验访问身份" />
      </section>

      <section className="how-section">
        <div className="section-heading">
          <span className="eyebrow">简单，但不是随便</span>
          <h2>把复杂的健康目标，拆成清楚的三步</h2>
        </div>
        <div className="step-grid">
          <ProcessCard number="01" title="告诉我们现状" text="用 7 个问题了解你的基础情况、目标和活动频率。" />
          <ProcessCard number="02" title="得到个人参考" text="系统即时计算 BMI、热量参考和合理的目标节奏。" />
          <ProcessCard number="03" title="带走明确方向" text="保存结果到账号，在不同设备上继续查看已解锁内容。" />
        </div>
      </section>

      <section className="final-cta">
        <div>
          <span className="eyebrow">从一个诚实的起点开始</span>
          <h2>准备好了解自己的健康方向了吗？</h2>
        </div>
        <Link className="secondary-button" href="/quiz">
          立即开始 <ArrowRightIcon />
        </Link>
      </section>
    </main>
  );
}

interface TrustItemProps {
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly detail: string;
}

function TrustItem({ icon, title, detail }: TrustItemProps): React.ReactElement {
  return (
    <div className="trust-item">
      <span className="feature-icon">{icon}</span>
      <span><strong>{title}</strong><small>{detail}</small></span>
    </div>
  );
}

interface ProcessCardProps {
  readonly number: string;
  readonly title: string;
  readonly text: string;
}

function ProcessCard({ number, title, text }: ProcessCardProps): React.ReactElement {
  return (
    <article className="process-card">
      <span>{number}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function ArrowRightIcon(): React.ReactElement {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}

function ShieldIcon(): React.ReactElement {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.6 2.9 8.8 7 10 4.1-1.2 7-5.4 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
}

function ClockIcon(): React.ReactElement {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
}

function CompassIcon(): React.ReactElement {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="m15 9-2 4-4 2 2-4 4-2Z" /></svg>;
}

function LockIcon(): React.ReactElement {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
}
