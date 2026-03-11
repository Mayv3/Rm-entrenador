export const queryKeys = {
  students: ["students"] as const,
  payments: ["payments"] as const,
  planes: ["planes"] as const,
  files: ["files"] as const,
  paymentHistory: (id: number) => ["paymentHistory", id] as const,
  allPaymentHistory: ["allPaymentHistory"] as const,
}
