"use client";

import { useEffect, useState } from "react";
import { Edit, MessageSquare, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AddPaymentDialog } from "@/components/add-payment-dialog";
import { EditPaymentDialog } from "@/components/edit-payment-dialog";
import { DeletePaymentDialog } from "@/components/delete-payment-dialog";
import { PaymentStats } from "./payment-stats";
import axios from "axios";

const parseDate = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
};

const determineSubscriptionStatus = (pago) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const fechaVencimiento = parseDate(pago.fecha_de_vencimiento);
  if (!fechaVencimiento) return "Indefinido";
  fechaVencimiento.setHours(0, 0, 0, 0);

  const fechaPago = parseDate(pago.fecha_de_pago);

  if (!fechaPago) {
    const diasVencido = Math.floor((hoy - fechaVencimiento) / (1000 * 60 * 60 * 24));

    if (diasVencido > 31) {
      return "No renovado";
    }

    return hoy > fechaVencimiento ? "Vencido" : "Pagado";
  }

  return "Pagado";
};


export function PaymentsTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [isEditPaymentOpen, setIsEditPaymentOpen] = useState(false);
  const [isDeletePaymentOpen, setIsDeletePaymentOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [payments, setPayments] = useState([]);
  const [refreshPayments, setRefreshPayments] = useState(false);

  const parseLocalDate = (dateString) => {
    if (!dateString) return null;
    if (dateString instanceof Date) return dateString;
    const date = new Date(dateString);
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() + offset);
  };

  const fetchPayments = async () => {
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/getAllPayments`);
      const normalizedPayments = response.data.map(payment => ({
        ...payment,
        monto: Number(payment.monto.toString().replace(/[^\d.-]/g, '')),
        fecha_de_pago: parseLocalDate(payment.fecha_de_pago),
        fecha_de_vencimiento: parseLocalDate(payment.fecha_de_vencimiento),
        status: determineSubscriptionStatus({
          fecha_de_vencimiento: payment.fecha_de_vencimiento
        })
      }));
      setPayments(normalizedPayments);
    } catch (error) {
      console.error("Error al obtener los pagos:", error);
    }
  };

  useEffect(() => {
    fetchPayments();

    const updateAtMidnight = () => {
      const now = new Date();
      const midnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0, 0, 0
      );
      const timeToMidnight = midnight - now;

      setTimeout(() => {
        setRefreshPayments(prev => !prev);
        // Configurar para que se repita cada 24 horas
        const intervalId = setInterval(() => {
          setRefreshPayments(prev => !prev);
        }, 24 * 60 * 60 * 1000);

        return () => clearInterval(intervalId);
      }, timeToMidnight);
    };

    updateAtMidnight();
  }, [refreshPayments]);

  // Calcular totales
  const totalPaid = payments.reduce((sum, p) => p.status === "Pagado" ? sum + p.monto : sum, 0);
  const totalOverdue = payments.reduce((sum, p) => p.status === "Vencido" ? sum + p.monto : sum, 0);

  const filteredPayments = payments
    .filter((payment) =>
      payment.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.modalidad?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.status?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => (b.fecha_de_vencimiento || 0) - (a.fecha_de_vencimiento || 0));

  const handleEdit = (payment) => {
    setSelectedPayment(payment);
    setIsEditPaymentOpen(true);
  };

  const handleDelete = (payment) => {
    setSelectedPayment(payment);
    setIsDeletePaymentOpen(true);
  };

  const formatDate = (date) => {
    return date ? date.toLocaleDateString() : "No definido";
  };

  const getDaysOverdue = (dueDate) => {
    if (!dueDate) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    return Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
  };

  return (
    <>
      <PaymentStats totalPaid={totalPaid} totalOverdue={totalOverdue} />

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
        <Button
          size="sm"
          className="h-8 gap-1 bg-[var(--primary-color)] hover:bg-[var(--primary-color)]"
          onClick={() => setIsAddPaymentOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden xs:inline">Nuevo Pago</span>
        </Button>
      </div>

      <Card className="border-none">
        <CardHeader className="px-0">
          <CardTitle>Suscripciones</CardTitle>
          <CardDescription>Gestiona los pagos y vencimientos de tus alumnos.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alumno</TableHead>
                <TableHead>Modalidad</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Último Pago</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Whatsapp</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((payment) => {
                const isOverdue = payment.status === "Vencido";
                const daysOverdue = isOverdue ? getDaysOverdue(payment.fecha_de_vencimiento) : 0;

                return (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.nombre}</TableCell>
                    <TableCell>{payment.modalidad}</TableCell>
                    <TableCell>${payment.monto?.toLocaleString()}</TableCell>
                    <TableCell>{formatDate(payment.fecha_de_pago)}</TableCell>
                    <TableCell>{formatDate(payment.fecha_de_vencimiento)}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          payment.status === "Pagado" ? "bg-green-500" :
                          payment.status === "Vencido" ? "bg-red-500" :
                          payment.status === "Pendiente" ? "bg-yellow-500" :
                          payment.status === "No renovado" ? "bg-black text-white" : "bg-gray-500"
                        }
                      >
                        {payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                            <a
                              href={`https://wa.me/${payment.whatsapp.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </a>
                          </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(payment)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(payment)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AddPaymentDialog
        open={isAddPaymentOpen}
        onOpenChange={setIsAddPaymentOpen}
        onPaymentUpdated={() => setRefreshPayments(prev => !prev)}
      />
      {selectedPayment && (
        <>
          <EditPaymentDialog
            open={isEditPaymentOpen}
            onOpenChange={setIsEditPaymentOpen}
            payment={selectedPayment}
            onPaymentUpdated={() => setRefreshPayments(prev => !prev)}
          />
          <DeletePaymentDialog
            open={isDeletePaymentOpen}
            onOpenChange={setIsDeletePaymentOpen}
            payment={selectedPayment}
            onPaymentDeleted={() => setRefreshPayments(prev => !prev)}
          />
        </>
      )}
    </>
  );
}