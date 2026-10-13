export interface KanbanItem {
  lotNumber: number;
  orderId: number;
  orderNumber: number;
  itemCode: string;
  itemDescription: string;
  quantidade: number;
}

export interface KanbanDeleteResponse {
  deleted: boolean;
  message: string;
}

export interface KanbanDeleteResult {
  orderId: number;
  success: boolean;
  message?: string;
}
