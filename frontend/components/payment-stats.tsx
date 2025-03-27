import { DollarSign, Clock, AlertTriangle, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface PaymentStatsProps {
  totalPaid: number
  totalPending: number
  totalOverdue: number
  totalIncome: number
}

export function PaymentStats({ totalPaid, totalPending, totalOverdue, totalIncome }: PaymentStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Pagado</CardTitle>
          <DollarSign className="h-4 w-4 text-[var(--primary-color)]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${totalPaid.toLocaleString()}</div>
          <p className="text-xs text-[var(--primary-color)]">Pagos completados</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pagos Vencidos</CardTitle>
          <AlertTriangle className="h-4 w-4 text-[var(--primary-color)]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${totalOverdue.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Requieren atención</p>
        </CardContent>
      </Card>
    </div>
  )
}

