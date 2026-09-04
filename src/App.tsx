import { useState } from 'react';
import type { Tab } from './types';
import MacroView from './MacroView';
import ScreeningView from './ScreeningView';
import DeepDiveView from './DeepDiveView';
import PortfolioView from './PortfolioView';
import FreshnessBanner from './FreshnessBanner';
import PriceRefreshButton from './PriceRefreshButton';

const tabs: { id: Tab; step: string; label: string }[] = [
  { id: 'macro',     step: 'ステップ1', label: 'マクロ分析' },
  { id: 'screening', step: 'ステップ2', label: 'スクリーニング' },
  { id: 'deepdive',  step: 'ステップ3', label: '深掘り分析' },
  { id: 'portfolio', step: '最終',       label: 'ポートフォリオ' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('macro');

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 shrink-0 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📈</span>
            <div>
              <h1 className="text-xl font-bold text-gray-900">日本株分析ダッシュボード</h1>
              <p className="text-xs text-gray-500">個人投資家向け半年運用スクリーニング (v2 pipeline)</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <FreshnessBanner />
            <PriceRefreshButton />
            <p className="text-xs text-amber-600 font-medium whitespace-nowrap">⚠ 投資判断は自己責任で</p>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-white border-b border-gray-200 px-6 shrink-0">
        <div className="max-w-7xl mx-auto flex">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 border-b-2 transition-colors text-left ${
                activeTab === tab.id
                  ? 'border-emerald-600 bg-emerald-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className={`text-xs font-semibold ${activeTab === tab.id ? 'text-emerald-600' : 'text-gray-400'}`}>
                {tab.step}
              </div>
              <div className={`text-sm font-medium ${activeTab === tab.id ? 'text-emerald-700' : 'text-gray-600'}`}>
                {tab.label}
              </div>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {activeTab === 'macro'     && <MacroView />}
          {activeTab === 'screening' && <ScreeningView />}
          {activeTab === 'deepdive'  && <DeepDiveView />}
          {activeTab === 'portfolio' && <PortfolioView />}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-6 py-3 shrink-0">
        <p className="text-center text-xs text-gray-400">
          本ダッシュボードは公開情報の整理を目的としており、金融アドバイスではありません。投資判断はご自身の責任で行ってください。
        </p>
      </footer>
    </div>
  );
}
