import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { KanbanDeleteResponse, KanbanItem } from '../interface/kanban-exclusion.interface';

@Injectable({ providedIn: 'root' })
export class KanbanExclusionService {
  private readonly api = environment.apiUrl + '/api/pcp/kanban-exclusion';

  constructor(private http: HttpClient) {}

  findByLotNumber(lotNumber: string): Observable<KanbanItem[]> {
    const params = new HttpParams().set('lotNumber', lotNumber);
    return this.http.get<KanbanItemResponse[]>(this.api, { params }).pipe(
      map(items => items.map(item => ({
        lotNumber: item.lotNumber ?? item.num_lote ?? 0,
        orderId: item.orderId ?? item.id_ordem ?? 0,
        orderNumber: item.orderNumber ?? item.num_ordem ?? 0,
        itemCode: item.itemCode ?? item.cod_item ?? '',
        itemDescription: item.itemDescription ?? item.desc_item ?? '',
        quantidade: item.quantidade ?? 0
      })))
    );
  }

  deleteManufacturingOrder(orderId: number): Observable<KanbanDeleteResponse> {
    return this.http.delete<KanbanDeleteResponse>(`${this.api}/${orderId}`);
  }
}

interface KanbanItemResponse extends Partial<KanbanItem> {
  num_lote?: number;
  id_ordem?: number;
  num_ordem?: number;
  cod_item?: string;
  desc_item?: string;
}
