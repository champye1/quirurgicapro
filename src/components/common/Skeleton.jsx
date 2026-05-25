import SkeletonLoader from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8">
      <SkeletonLoader height={24} width="60%" className="mb-4" />
      <SkeletonLoader height={16} count={3} className="mb-2" />
      <SkeletonLoader height={40} width="40%" />
    </div>
  )
}

export function MetricSkeleton() {
  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 flex items-center gap-5">
      <SkeletonLoader circle width={56} height={56} />
      <div className="flex-1">
        <SkeletonLoader height={12} width="40%" className="mb-2" />
        <SkeletonLoader height={28} width="60%" />
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <SkeletonLoader height={60} width="100%" />
        </div>
      ))}
    </div>
  )
}

/** Use inside a <tbody> when the real table is already rendered. */
export function TableBodySkeleton({ rows = 5, cols = 4 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: cols }).map((__, j) => (
        <td key={j} className="py-3 px-4">
          <SkeletonLoader height={16} width={j === 0 ? '60%' : '80%'} />
        </td>
      ))}
    </tr>
  ))
}

export default CardSkeleton
