'use client'

import Layout, { ModuleId } from '@/components/Layout'
import {
  Module200Week,
  ModuleWatchlist,
  ModuleHeatmap,
  ModuleSectors,
  Module200Day,
  ModuleBestSignals,
  ModuleBTCTrend,
  ModuleTrend,
  ModuleBacktest,
} from '@/components/modules'

export default function Home() {
  return (
    <Layout>
      {(activeModule: ModuleId) => {
        switch (activeModule) {
          case '200week':
            return <Module200Week />
          case '200day':
            return <Module200Day />
          case 'bestsignals':
            return <ModuleBestSignals />
          case 'trend':
            return <ModuleTrend />
          case 'btctrend':
            return <ModuleBTCTrend />
          case 'watchlist':
            return <ModuleWatchlist />
          case 'heatmap':
            return <ModuleHeatmap />
          case 'sectors':
            return <ModuleSectors />
          case 'backtest':
            return <ModuleBacktest />
          default:
            return <Module200Week />
        }
      }}
    </Layout>
  )
}
