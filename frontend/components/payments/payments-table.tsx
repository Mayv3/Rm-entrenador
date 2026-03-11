"use client";

import { useMemo, useState } from "react";
import { Calendar, Edit, History, MessageSquare, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AddPaymentDialog } from "./add-payment-dialog";
import { EditPaymentDialog } from "./edit-payment-dialog";
import { DeletePaymentDialog } from "./delete-payment-dialog";
import { PaymentHistoryDialog } from "./payment-history-dialog";
import { PaymentHistoryGlobalDialog } from "./payment-history-global-dialog";
import { PaymentStats } from "./payment-stats";
import { Loader } from "@/components/ui/loader";
import { GenericDataGrid } from "@/components/tables/DataGrid";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GridColDef } from "@mui/x-data-grid";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  parseLocalDate,
  determineSubscriptionStatus,
  getStatusColor,
  formatDate,
} from "@/lib/payment-utils";
import { usePlanes, getPlanColor } from "@/hooks/use-planes";

export { parseLocalDate, determineSubscriptionStatus, getStatusColor, formatDate };

interface Payment {
  id: number;
  nombre: string;
  modalidad: string;
  monto: number;
  fecha_de_pago: Date | null;
  fecha_de_vencimiento: Date | null;
  status: string;
  whatsapp: string;
  [key: string]: any;
}

// ─── Subcomponente mobile ─────────────────────────────────────────────────────

function PaymentMobileCard({
  payment,
  onEdit,
  onDelete,
}: {
  payment: Payment;
  onEdit: (p: Payment) => void;
  onDelete: (p: Payment) => void;
}) {
  return (
    <Card className="p-3 py-4 cursor-pointer" onClick={() => onEdit(payment)}>
      <CardHeader className="pb-4">
        <CardTitle>{payment.nombre}</CardTitle>
        <CardDescription className="text-lg">{payment.modalidad}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Monto:</span>
          <span>${payment.monto?.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Último pago:</span>
          <span>{formatDate(payment.fecha_de_pago)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Vencimiento:</span>
          <span>{formatDate(payment.fecha_de_vencimiento)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Estado:</span>
          <Badge style={{ backgroundColor: getStatusColor(payment.status) }}>{payment.status}</Badge>
        </div>
        <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
          <a
            href={`https://wa.me/${payment.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center py-2 rounded bg-[var(--primary-color)] text-white hover:bg-green-600 transition-colors"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="ml-2">WhatsApp</span>
          </a>
        </div>
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" onClick={() => onEdit(payment)} variant="outline" className="flex-1 w-full">
            <Edit className="h-4 w-4" /> Editar
          </Button>
          <Button size="sm" onClick={() => onDelete(payment)} variant="destructive" className="flex-1 w-full">
            <Trash2 className="h-4 w-4" /> Eliminar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function PaymentsTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [isEditPaymentOpen, setIsEditPaymentOpen] = useState(false);
  const [isDeletePaymentOpen, setIsDeletePaymentOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isGlobalHistoryOpen, setIsGlobalHistoryOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const { data: planes = [] } = usePlanes();

  const { data: rawPayments = [], isLoading } = useQuery({
    queryKey: queryKeys.payments,
    queryFn: () =>
      axios.get<any[]>(`${process.env.NEXT_PUBLIC_URL_BACKEND}/getAllPayments`).then((r) => r.data),
  });

  const payments = useMemo<Payment[]>(
    () =>
      rawPayments.map((p) => ({
        ...p,
        monto: Number(p.monto.toString().replace(/[^\d.-]/g, "")),
        fecha_de_pago: parseLocalDate(p.fecha_de_pago),
        fecha_de_vencimiento: parseLocalDate(p.fecha_de_vencimiento),
        status: determineSubscriptionStatus(p),
      })),
    [rawPayments]
  );

  const stats = useMemo(() => {
    const active = payments.filter((p) => p.status !== "Vencidos");
    const paid = active.filter((p) => p.status === "Pagado");
    const overdue = active.filter((p) => p.status === "Vencido");
    return {
      totalPaid: paid.reduce((sum, p) => sum + p.monto, 0),
      totalOverdue: overdue.reduce((sum, p) => sum + p.monto, 0),
      totalPaidStudents: paid.length,
      totalOverdueStudents: overdue.length,
      loyaltyPercentage: active.length > 0 ? Math.round((paid.length / active.length) * 100) : 0,
      planCounts: {
        Basico: payments.filter((p) => p.modalidad === "Básico" && p.status === "Pagado").length,
        Estandar: payments.filter((p) => p.modalidad === "Estándar" && p.status === "Pagado").length,
        Premium: payments.filter((p) => p.modalidad === "Premium" && p.status === "Pagado").length,
      },
    };
  }, [payments]);

  const filteredPayments = useMemo(
    () =>
      payments.filter(
        (p) =>
          p.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.modalidad?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.status?.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [payments, searchTerm]
  );

  const handleEdit = (payment: Payment) => { setSelectedPayment(payment); setIsEditPaymentOpen(true); };
  const handleDelete = (payment: Payment) => { setSelectedPayment(payment); setIsDeletePaymentOpen(true); };
  const handleHistory = (payment: Payment) => { setSelectedPayment(payment); setIsHistoryOpen(true); };

  const modalidadColor = (m: string) => getPlanColor(planes, m);

  const paymentsColumns: GridColDef[] = [
    {
      field: "nombre", headerName: "Alumno", flex: 1, minWidth: 120, maxWidth: 180,
      renderCell: ({ row, value }) => (
        <span
          className="cursor-pointer hover:text-[var(--primary-color)] hover:underline transition-colors"
          onClick={() => handleEdit(row as Payment)}
        >
          {value}
        </span>
      ),
    },
    {
      field: "modalidad", headerName: "Plan", flex: 1, minWidth: 110,
      renderCell: ({ value }) => (
        <div className="flex items-center">
          <span className="inline-block w-[10px] h-[10px] rounded-full mr-2" style={{ backgroundColor: modalidadColor(value) }} />
          {value}
        </div>
      ),
    },
    {
      field: "monto", headerName: "Monto", flex: 1, minWidth: 90,
      renderCell: ({ value }) => `$${value?.toLocaleString()}`,
    },
    {
      field: "fecha_de_pago", headerName: "Último Pago", flex: 1, minWidth: 110, type: "date",
      renderCell: ({ value }) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {formatDate(value)}
        </div>
      ),
    },
    {
      field: "fecha_de_vencimiento", headerName: "Vencimiento", flex: 1, minWidth: 110, type: "date",
      renderCell: ({ value }) => formatDate(value),
    },
    {
      field: "status", headerName: "Estado", flex: 0.8, minWidth: 100,
      renderCell: ({ value }) => (
        <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
          <Badge style={{ backgroundColor: getStatusColor(value), width: "90%", justifyContent: "center", padding: "6px 0" }}>
            {value}
          </Badge>
        </div>
      ),
    },
    {
      field: "whatsapp", headerName: "WA", width: 90, sortable: false,
      renderCell: ({ value }) => (
        <div className="flex items-center justify-center w-full h-full" onClick={(e) => e.stopPropagation()}>
          <a href={`https://wa.me/${value?.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center w-[85%] h-[75%] rounded-md bg-green-500 text-white hover:bg-green-600 transition-colors">
            <MessageSquare className="h-4 w-4" />
          </a>
        </div>
      ),
    },
    {
      field: "acciones", headerName: "", width: 50, sortable: false,
      renderCell: ({ row }) => (
        <div className="flex items-center justify-center w-full h-full" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEdit(row as Payment)} className="text-blue-600 cursor-pointer">
                <Edit className="h-4 w-4 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleHistory(row as Payment)} className="cursor-pointer">
                <History className="h-4 w-4 mr-2" /> Historial
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDelete(row as Payment)} className="text-red-600 cursor-pointer">
                <Trash2 className="h-4 w-4 mr-2" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <>
      <PaymentStats
        totalPaid={stats.totalPaid}
        totalOverdue={stats.totalOverdue}
        totalPaidStudents={stats.totalPaidStudents}
        totalOverdueStudents={stats.totalOverdueStudents}
        loyaltyPercentage={stats.loyaltyPercentage}
        totalStudents={payments.length}
        planCounts={stats.planCounts}
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
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="hidden md:flex h-10 gap-1.5"
            onClick={() => setIsGlobalHistoryOpen(true)}
          >
            <History className="h-4 w-4" />
            Historial de pagos
          </Button>
          <Button
            size="sm"
            className="fixed bottom-24 right-4 w-16 h-16 rounded-full gap-1 bg-[var(--primary-color)] hover:bg-[var(--primary-color)] active:scale-90 md:active:scale-95 transition-transform duration-100 md:static md:h-10 md:w-[150px] md:py-2 md:rounded-md"
            onClick={() => setIsAddPaymentOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Nuevo Pago</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:hidden">
            {filteredPayments.map((payment) => (
              <PaymentMobileCard key={payment.id} payment={payment} onEdit={handleEdit} onDelete={handleDelete} />
            ))}
          </div>
          <div className="hidden md:block">
            <GenericDataGrid
              rows={filteredPayments}
              columns={paymentsColumns}
              initialSortModel={[{ field: "fecha_de_vencimiento", sort: "desc" }]}
              onRowClick={(row) => handleEdit(row as Payment)}
            />
          </div>
        </>
      )}

      <AddPaymentDialog open={isAddPaymentOpen} onOpenChange={setIsAddPaymentOpen} onPaymentUpdated={() => {}} />
      <PaymentHistoryGlobalDialog open={isGlobalHistoryOpen} onOpenChange={setIsGlobalHistoryOpen} />
      {selectedPayment && (
        <>
          <EditPaymentDialog
            open={isEditPaymentOpen}
            onOpenChange={setIsEditPaymentOpen}
            payment={selectedPayment}
            onPaymentUpdated={() => {}}
          />
          <DeletePaymentDialog
            open={isDeletePaymentOpen}
            onOpenChange={setIsDeletePaymentOpen}
            payment={{ id: selectedPayment.id.toString(), studentName: selectedPayment.nombre, amount: selectedPayment.monto }}
            onPaymentDeleted={() => {}}
          />
          <PaymentHistoryDialog
            open={isHistoryOpen}
            onOpenChange={setIsHistoryOpen}
            payment={{ id: selectedPayment.id, nombre: selectedPayment.nombre }}
          />
        </>
      )}
    </>
  );
}
