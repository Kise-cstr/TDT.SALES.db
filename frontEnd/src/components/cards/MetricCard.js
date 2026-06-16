import { memo, useMemo } from 'react';
import { TrendingUp, TrendingDown, Users, DollarSign, Target, BarChart3 } from 'lucide-react';
import '../../styles/cards.css';

function MetricCard({ title, value, trend, trendValue, icon, interactive = false }) {
  const cardIcon = useMemo(() => {
    switch (icon) {
      case 'users':
        return <Users size={24} />;
      case 'dollar':
        return <DollarSign size={24} />;
      case 'target':
        return <Target size={24} />;
      case 'chart':
        return <BarChart3 size={24} />;
      default:
        return <BarChart3 size={24} />;
    }
  }, [icon]);

  const trendColor = trend === 'up' ? '#fb923c' : '#ef4444';

  return (
    <div className={`metric-card ${interactive ? 'metric-card-interactive' : ''}`}>
      <div className="glass-inner" />
      <div className="metric-header">
        <div className="metric-icon">{cardIcon}</div>
        {trend && (
          <div className="metric-trend">
            {trend === 'up' ? <TrendingUp size={16} color={trendColor} /> : <TrendingDown size={16} color={trendColor} />}
            <span style={{ color: trendColor }}>{trendValue}</span>
          </div>
        )}
      </div>
      <h3 className="metric-title">{title}</h3>
      <h1 className="metric-value">{value}</h1>
    </div>
  );
}

export default memo(MetricCard);
