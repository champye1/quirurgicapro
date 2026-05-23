import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useTheme } from '../../contexts/ThemeContext'

export default function OcupacionChart({ data, mode = 'porcentaje' }) {
  const { theme } = useTheme()
  const colors = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd']
  
  const isDark = theme === 'dark'
  const dataKey = mode === 'horas_ocupadas'
    ? 'ocupadasHoras'
    : mode === 'horas_libres'
    ? 'libresHoras'
    : 'porcentaje'

  const yAxisLabel = mode === 'horas_ocupadas'
    ? 'Horas ocupadas (total pabellones)'
    : mode === 'horas_libres'
    ? 'Horas libres (total pabellones)'
    : 'Ocupación %'
  
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid 
          strokeDasharray="3 3" 
          stroke={isDark ? '#475569' : '#e2e8f0'} 
        />
        <XAxis 
          dataKey="dia" 
          stroke={isDark ? '#94a3b8' : '#64748b'} 
          style={{ fontSize: '12px', fontWeight: '600' }}
          tick={{ fill: isDark ? '#cbd5e1' : '#475569' }}
        />
        <YAxis 
          stroke={isDark ? '#94a3b8' : '#64748b'} 
          style={{ fontSize: '12px', fontWeight: '600' }}
          tick={{ fill: isDark ? '#cbd5e1' : '#475569' }}
          label={{ 
            value: yAxisLabel, 
            angle: -90, 
            position: 'insideLeft', 
            style: { fontSize: '12px', fill: isDark ? '#cbd5e1' : '#475569' } 
          }}
        />
        <Tooltip 
          contentStyle={{
            borderRadius: '1rem',
            border: isDark ? '1px solid #475569' : '1px solid #e2e8f0',
            backgroundColor: isDark ? '#1e293b' : '#fff',
            padding: '12px',
            fontSize: '12px',
            color: isDark ? '#ffffff' : '#0f172a',
          }}
          labelStyle={{ 
            fontWeight: '700', 
            marginBottom: '4px',
            color: isDark ? '#ffffff' : '#0f172a',
          }}
          itemStyle={{
            color: isDark ? '#cbd5e1' : '#475569',
          }}
          formatter={(value, _name) => {
            if (mode === 'porcentaje') {
              const val = typeof value === 'number' ? value.toFixed(1) : value
              return [`${val} %`, 'Ocupación promedio']
            }
            const val = typeof value === 'number' ? value.toFixed(1) : value
            const etiqueta = mode === 'horas_ocupadas'
              ? 'Horas ocupadas (suma de todos los pabellones)'
              : 'Horas libres (suma de todos los pabellones)'
            return [`${val} h`, etiqueta]
          }}
          cursor={{ 
            fill: isDark ? 'rgba(71, 85, 105, 0.2)' : 'rgba(226, 232, 240, 0.3)',
            stroke: isDark ? '#475569' : '#cbd5e1',
            strokeWidth: 1,
          }}
        />
        <Bar dataKey={dataKey} radius={[8, 8, 0, 0]}>
          {data?.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
