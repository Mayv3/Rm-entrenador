import { DollarSign, Clock, AlertTriangle, TrendingUp, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface PaymentStatsProps {
  totalPaid: number
  totalOverdue: number
  totalPaidStudents: number
  totalOverdueStudents: number
  loyaltyPercentage: number
}

export function PaymentStats({ 
  totalPaid, 
  totalOverdue, 
  totalPaidStudents, 
  totalOverdueStudents, 
  loyaltyPercentage 
}: PaymentStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Tarjeta de Total Pagado */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Pagado</CardTitle>
          <DollarSign className="h-4 w-4 text-[var(--primary-color)]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${totalPaid.toLocaleString("es-AR")}</div>
          <p className="text-xs text-[var(--primary-color)]">
            {totalPaidStudents} {totalPaidStudents === 1 ? 'alumno' : 'alumnos'} al día
          </p>
        </CardContent>
      </Card>

      {/* Tarjeta de Pagos Vencidos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pagos Vencidos</CardTitle>
          <AlertTriangle className="h-4 w-4 text-[var(--primary-color)]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${totalOverdue.toLocaleString("es-AR")}</div>
          <p className="text-xs text-muted-foreground">
            {totalOverdueStudents} {totalOverdueStudents === 1 ? 'alumno' : 'alumnos'} atrasados
          </p>
        </CardContent>
      </Card>

      {/* Nueva Tarjeta de Fidelidad */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Fidelidad</CardTitle>
          <TrendingUp className="h-4 w-4 text-[var(--primary-color)]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{loyaltyPercentage}%</div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div 
              className="bg-[var(--primary-color)] h-2 rounded-full" 
              style={{ width: `${loyaltyPercentage}%` }}
            ></div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Tasa de retención de alumnos
          </p>
        </CardContent>
      </Card>
    </div>
  )
}