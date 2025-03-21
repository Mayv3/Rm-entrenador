"use client"

import { useState } from "react"
import { Calendar, ChevronDown, Download, Edit, Plus, Search, SlidersHorizontal, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { AddPaymentDialog } from "@/components/add-payment-dialog"
import { PaymentStats } from "@/components/payment-stats"
import { EditPaymentDialog } from "@/components/edit-payment-dialog"
import { DeletePaymentDialog } from "@/components/delete-payment-dialog"

// Sample data - in a real app this would come from a database
const payments = [
  {
    id: "1",
    studentName: "Carlos Rodríguez",
    amount: 15000,
    date: "2023-07-01",
    dueDate: "2023-07-31",
    modality: "Presencial",
    status: "Pagado",
  },
  {
    id: "2",
    studentName: "María González",
    amount: 12000,
    date: "2023-06-28",
    dueDate: "2023-07-28",
    modality: "Online",
    status: "Pendiente",
  },
  {
    id: "3",
    studentName: "Juan Pérez",
    amount: 18000,
    date: "2023-07-05",
    dueDate: "2023-08-05",
    modality: "Híbrido",
    status: "Pagado",
  },
  {
    id: "4",
    studentName: "Laura Martínez",
    amount: 15000,
    date: "2023-06-15",
    dueDate: "2023-07-15",
    modality: "Presencial",
    status: "Vencido",
  },
  {
    id: "5",
    studentName: "Fernando López",
    amount: 12000,
    date: "2023-07-03",
    dueDate: "2023-08-03",
    modality: "Online",
    status: "Pagado",
  },
]

export function PaymentsTable() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false)
  const [isEditPaymentOpen, setIsEditPaymentOpen] = useState(false)
  const [isDeletePaymentOpen, setIsDeletePaymentOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<(typeof payments)[0] | null>(null)

  const filteredPayments = payments.filter(
    (payment) =>
      payment.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.modality.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.status.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Calculate statistics
  const totalPaid = payments.filter((p) => p.status === "Pagado").reduce((sum, p) => sum + p.amount, 0)
  const totalPending = payments.filter((p) => p.status === "Pendiente").reduce((sum, p) => sum + p.amount, 0)
  const totalOverdue = payments.filter((p) => p.status === "Vencido").reduce((sum, p) => sum + p.amount, 0)
  const totalIncome = totalPaid + totalPending

  const handleEdit = (payment: (typeof payments)[0]) => {
    setSelectedPayment(payment)
    setIsEditPaymentOpen(true)
  }

  const handleDelete = (payment: (typeof payments)[0]) => {
    setSelectedPayment(payment)
    setIsDeletePaymentOpen(true)
  }

  return (
    <>
      <PaymentStats
        totalPaid={totalPaid}
        totalPending={totalPending}
        totalOverdue={totalOverdue}
        totalIncome={totalIncome}
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar pagos..."
            className="w-full pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Filtros</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem>Pagado</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>Pendiente</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>Vencido</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>Presencial</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>Online</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>Híbrido</DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" className="h-8 gap-1">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Exportar</span>
          </Button>
          <Button size="sm" className="h-8 gap-1" onClick={() => setIsAddPaymentOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Nuevo Pago</span>
          </Button>
        </div>
      </div>

      <Card className="border-none">
        <CardHeader className="px-0">
          <CardTitle>Pagos</CardTitle>
          <CardDescription>Gestiona los pagos y vencimientos de tus alumnos.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Tabla para pantallas grandes */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alumno</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead className="hidden md:table-cell">Fecha de Pago</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="hidden lg:table-cell">Modalidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.studentName}</TableCell>
                    <TableCell>${payment.amount.toLocaleString()}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {new Date(payment.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {new Date(payment.dueDate).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{payment.modality}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          payment.status === "Pagado"
                            ? "success"
                            : payment.status === "Pendiente"
                              ? "warning"
                              : "destructive"
                        }
                      >
                        {payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => handleEdit(payment)}
                        >
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Editar</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(payment)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Eliminar</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Cards en móviles */}
          <div className="grid gap-4 md:hidden">
            {filteredPayments.map((payment) => (
              <Card key={payment.id} className="p-2 shadow-md">
                <CardHeader>
                  <div className="flex justify-between">
                  <CardTitle className="text-xl">{payment.studentName}</CardTitle>

                  <div className="flex items-center">
                    <Badge
                      variant={
                        payment.status === "Pagado"
                          ? "success"
                          : payment.status === "Pendiente"
                            ? "warning"
                            : "destructive"
                      }
                      className="text-sm px-4 rounded-[300px]"
                    >
                      {payment.status}
                    </Badge>
                  </div>
                  </div>

                </CardHeader>
                <CardContent className="space-y-2 mt-0">
                  <div className="flex items-center gap-2"
                  > 
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="">Fecha de Pago:</span> {new Date(payment.date).toLocaleDateString()}
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="">Vencimiento:</span> {new Date(payment.dueDate).toLocaleDateString()}
                  </div>

                  <div>
                    <span className="">Monto:</span> ${payment.amount.toLocaleString()}
                  </div>


                  {/* Botones de acción */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleEdit(payment)}
                      variant="outline"
                      className="flex-1 w-full"
                    >
                      <Edit className="h-4 w-4" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleDelete(payment)}
                      variant="destructive"
                      className="flex-1 w-full"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <AddPaymentDialog open={isAddPaymentOpen} onOpenChange={setIsAddPaymentOpen} />

      {selectedPayment && (
        <>
          <EditPaymentDialog open={isEditPaymentOpen} onOpenChange={setIsEditPaymentOpen} payment={selectedPayment} />
          <DeletePaymentDialog
            open={isDeletePaymentOpen}
            onOpenChange={setIsDeletePaymentOpen}
            payment={selectedPayment}
          />
        </>
      )}
    </>
  )
}

