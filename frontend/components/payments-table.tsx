"use client";

import { useEffect, useState } from "react";
import { Calendar, Edit, FileText, MessageSquare, Plus, Search, Trash2 } from "lucide-react";
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
import { Loader } from "@/components/ui/loader";


const determineSubscriptionStatus = (pago) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const fechaPago = parseLocalDate(pago.fecha_de_pago);
  const fechaVencimiento = parseLocalDate(pago.fecha_de_vencimiento);

  if (!fechaVencimiento || isNaN(fechaVencimiento.getTime())) {
    return "Indefinido";
  }

  fechaVencimiento.setHours(0, 0, 0, 0);

  const diasVencido = Math.floor((hoy - fechaVencimiento) / (1000 * 60 * 60 * 24));

  if (diasVencido > 31) {
    return "No renovado";
  }

  if (hoy > fechaVencimiento) {
    return "Vencido";
  }

  if (fechaPago && !isNaN(fechaPago.getTime())) {
    return "Pagado";
  }

  return "Pendiente";
};

const parseLocalDate = (dateString) => {
  if (!dateString) return null;
  if (dateString instanceof Date) return dateString;
  
  if (typeof dateString === 'string' && dateString.includes('/')) {
    const [day, month, year] = dateString.split('/');
    const parsedDate = new Date(year, month - 1, day);
    return isNaN(parsedDate.getTime()) ? null : parsedDate;
  }
  
  const isoDate = new Date(dateString);
  if (!isNaN(isoDate.getTime())) return isoDate;
  
  return null;
};

const formatDate = (date) => {
  if (!date) return "No definido";
  
  const parsedDate = date instanceof Date ? date : parseLocalDate(date);
  if (!parsedDate || isNaN(parsedDate.getTime())) return "Fecha inválida";

  const day = String(parsedDate.getDate()).padStart(2, '0');
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const year = parsedDate.getFullYear();
  
  return `${day}-${month}-${year}`;
};

export function PaymentsTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [isEditPaymentOpen, setIsEditPaymentOpen] = useState(false);
  const [isDeletePaymentOpen, setIsDeletePaymentOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [payments, setPayments] = useState([]);
  const [refreshPayments, setRefreshPayments] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const activePayments = payments.filter(p => p.status !== "No renovado");

  const totalPaid = activePayments.reduce((sum, p) => p.status === "Pagado" ? sum + Number(p.monto) : sum, 0);
  const totalOverdue = activePayments.reduce((sum, p) => p.status === "Vencido" ? sum + Number(p.monto) : sum, 0);

  const totalPaidStudents = activePayments.filter(p => p.status === "Pagado").length;
  const totalOverdueStudents = activePayments.filter(p => p.status === "Vencido").length;
  const totalActiveStudents = activePayments.length;
  const loyaltyPercentage = totalActiveStudents > 0
    ? Math.round((totalPaidStudents / totalActiveStudents) * 100)
    : 0;

  const fetchPayments = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/getAllPayments`);
      const normalizedPayments = response.data.map(payment => ({
        ...payment,
        monto: Number(payment.monto.toString().replace(/[^\d.-]/g, '')),
        fecha_de_pago: parseLocalDate(payment.fecha_de_pago),
        fecha_de_vencimiento: parseLocalDate(payment.fecha_de_vencimiento),
        status: determineSubscriptionStatus(payment) // Pasa el objeto completo
      }));
      setPayments(normalizedPayments);
    } catch (error) {
      console.error("Error al obtener los pagos:", error);
    } finally {
      setIsLoading(false);
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
        const intervalId = setInterval(() => {
          setRefreshPayments(prev => !prev);
        }, 24 * 60 * 60 * 1000);

        return () => clearInterval(intervalId);
      }, timeToMidnight);
    };

    updateAtMidnight();
  }, [refreshPayments]);

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

  const getDaysOverdue = (dueDate) => {
    if (!dueDate) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    return Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Pagado":
        return "bg-green-500";
      case "Vencido":
        return "bg-red-500";
      case "No renovado":
        return "bg-black text-white";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <>
      <PaymentStats
        totalPaid={totalPaid}
        totalOverdue={totalOverdue}
        totalPaidStudents={totalPaidStudents}
        totalOverdueStudents={totalOverdueStudents}
        loyaltyPercentage={loyaltyPercentage}
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
        <Button
          size="sm"
          className="fixed bottom-16 right-4 w-16 h-16 rounded-full gap-1 bg-[var(--primary-color)] hover:bg-[var(--primary-color)] md:static md:h-10 md:w-[150px] md:py-2 md:rounded-md"
          onClick={() => setIsAddPaymentOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Nuevo Pago</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader />
        </div>
      ) : (
        <>
          {/* Vista mobile */}
          <div className="grid gap-4 md:hidden">
            {filteredPayments.map((payment) => {
              const isOverdue = payment.status === "Vencido";
              const daysOverdue = isOverdue ? getDaysOverdue(payment.fecha_de_vencimiento) : 0;

              return (
                <Card key={payment.id} className="p-3 py-4">
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
                      <Badge className={getStatusColor(payment.status)}>
                        {payment.status}
                      </Badge>
                    </div>

                    <div className="flex gap-2 pt-2">
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
              );
            })}
          </div>

          {/* Vista desktop */}
          <Card className="hidden md:block border-none">
            <CardHeader className="px-0">
              <CardTitle>Suscripciones</CardTitle>
              <CardDescription>Gestiona los pagos y vencimientos de tus alumnos.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {filteredPayments.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Alumno</TableHead>
                        <TableHead>Modalidad</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Último Pago</TableHead>
                        <TableHead>Vencimiento</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>WhatsApp</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayments.map((payment) => {
                        const isOverdue = payment.status === "Vencido";
                        const daysOverdue = isOverdue ? getDaysOverdue(payment.fecha_de_vencimiento) : 0;

                        return (
                          <TableRow key={payment.id}>
                            <TableCell className="font-medium">{payment.nombre}</TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                <span className={`inline-block w-[10px] h-[10px] rounded-full mr-2 ${
                                  payment.modalidad === 'Presencial' ? 'bg-green-500' :
                                  payment.modalidad === 'Online' ? 'bg-blue-500' : 'bg-purple-500'
                                }`} />
                                {payment.modalidad}
                              </div>
                            </TableCell>
                            <TableCell>${payment.monto?.toLocaleString()}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {formatDate(payment.fecha_de_pago)}
                              </div>
                            </TableCell>
                            <TableCell>
                              {formatDate(payment.fecha_de_vencimiento)}
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(payment.status)}>
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
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-blue-500 hover:text-blue-700"
                                  onClick={() => handleEdit(payment)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-700"
                                  onClick={() => handleDelete(payment)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No se encontraron pagos
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

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