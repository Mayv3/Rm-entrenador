import { DollarSign, Clock, AlertTriangle, TrendingUp, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface PaymentStatsProps {
  totalPaid: number
  totalOverdue: number
  totalPaidStudents: number
  totalOverdueStudents: number
  loyaltyPercentage: number
  totalStudents: number
  planCounts: {
    Basico: number
    Estandar: number
    Premium: number
  }
}

export function PaymentStats({
  totalPaid,
  totalOverdue,
  totalPaidStudents,
  totalOverdueStudents,
  loyaltyPercentage,
  totalStudents,
  planCounts

}: PaymentStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            Tasa de retención de alumnos: {totalPaidStudents} de {totalStudents}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Distribución de Planes</CardTitle>
          <Users className="h-4 w-4 text-[var(--primary-color)]" />
        </CardHeader>
        <CardContent>
          {(() => {
            const total = planCounts.Basico + planCounts.Estandar + planCounts.Premium;
            const plans = [
              { label: "Básico", value: planCounts.Basico, color: "#f44336" },
              { label: "Estándar", value: planCounts.Estandar, color: "#ff9800" },
              { label: "Premium", value: planCounts.Premium, color: "#7cb342" },
            ].map(p => ({
              ...p,
              pct: total ? Math.round((p.value / total) * 100) : 0,
            }));

            const sortedPlans = plans.sort((a, b) => b.value - a.value);
            const topPlan = sortedPlans[0];

            return (
              <div>
                <div className="text-xl font-bold">
                  {topPlan.label}: {topPlan.pct}%
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2 mt-2 flex overflow-hidden">
                  {sortedPlans.map(plan => (
                    <div
                      key={plan.label}
                      className="h-2"
                      style={{
                        width: `${plan.pct}%`,
                        backgroundColor: plan.color,
                      }}
                    />
                  ))}
                </div>

                {/* Leyenda como texto pequeño debajo */}
                <p className="text-xs text-muted-foreground mt-1">
                  {sortedPlans.map(plan => (
                    <span key={plan.label} className="mr-3">
                      <span
                        className="inline-block w-3 h-3 rounded-full mr-1"
                        style={{ backgroundColor: plan.color }}
                      ></span>
                      {plan.label}: {plan.value} ({plan.pct}%)
                    </span>
                  ))}
                </p>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  )
}