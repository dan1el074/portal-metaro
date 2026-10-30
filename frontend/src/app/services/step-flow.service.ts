import { HttpClient, HttpParams } from '@angular/common/http';
import { AdminDashboard, PagedResult, StepFlowChecklistEquipment, StepFlowData, StepFlowOrder, StepFlowOrderInfo, StepFlowVolume } from './../interface/step-flow.interface';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class StepFlowService {
  private api = environment.apiUrl + '/api/step-flow';

  constructor(private http: HttpClient) {}

  public findById(id: number): Observable<StepFlowOrder> {
    return this.http.get<StepFlowOrder>(this.api + '/' + id);
  }

  public findAll( page: number, size: number, sortColumn?: string, sortDirection?: 'asc' | 'desc', search?: string, stepFilter?: string): Observable<PagedResult<StepFlowData>> {
    let params = new HttpParams().set('page', page).set('size', size);
    const trimmedSearch = search?.trim();

    if (sortColumn) params = params.set('sort', `${sortColumn},${sortDirection ?? 'asc'}`);
    if (trimmedSearch) params = params.set('search', trimmedSearch);
    if (stepFilter) params = params.set('stepFilter', stepFilter);

    return this.http.get<PagedResult<StepFlowData>>(this.api, { params });
  }

  public findAllFromCurrentStep(index: number): Observable<Array<StepFlowData>> {
    return this.http.get<Array<StepFlowData>>(this.api + '/step/' + index);
  }

  public getDashboard(): Observable<AdminDashboard> {
    return this.http.get<AdminDashboard>(this.api + '/admin');
  }

  public findOrderInfoByNumber(orderNumber: number): Observable<StepFlowOrderInfo> {
    const params = new HttpParams().set('source', 'FOCCO');
    return this.http.get<StepFlowOrderInfo>(this.api + '/erp/' + orderNumber, { params });
  }

  public create(order: StepFlowOrderInfo, legacy = false): Observable<void> {
    const params = legacy ? new HttpParams().set('legacy', true) : undefined;
    return this.http.post<void>(this.api, order, { params });
  }

  public updateStep(orderId: number, formData: FormData): Observable<StepFlowOrder> {
    return this.http.put<StepFlowOrder>(this.api + '/' + orderId, formData);
  }

  public reopen(orderId: number): Observable<StepFlowOrder> {
    return this.http.put<StepFlowOrder>(`${this.api}/${orderId}/reopen`, {});
  }

  public nextStep(orderId: number): Observable<void> {
    return this.http.put<void>(this.api + '/' + orderId + '/nextStep', null);
  }

  public createVolume(orderId: number, volume: StepFlowVolume): Observable<StepFlowVolume> {
    return this.http.post<StepFlowVolume>(`${this.api}/${orderId}/volumes`, volume);
  }

  public updateVolume(orderId: number, volume: StepFlowVolume): Observable<StepFlowVolume> {
    return this.http.put<StepFlowVolume>(`${this.api}/${orderId}/volumes/${volume.id}`, volume);
  }

  public deleteVolume(orderId: number, volumeId: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${orderId}/volumes/${volumeId}`);
  }

  public deleteImageById(id: number): Observable<void> {
    return this.http.delete<void>(this.api + '/image/' + id);
  }

  public listChecklistEquipment(orderId: number): Observable<StepFlowChecklistEquipment[]> {
    return this.http.get<StepFlowChecklistEquipment[]>(`${environment.apiUrl}/api/checklist/step-flow/orders/${orderId}/equipment`)
      .pipe(map((equipment) => equipment.map((item) => ({
        ...item,
        flowId: String(item.flowId),
        recordId: item.recordId == null ? null : String(item.recordId),
      }))));
  }

  public listAvailableChecklistEquipment(orderNumber: number): Observable<StepFlowChecklistEquipment[]> {
    const params = new HttpParams().set('orderNumber', orderNumber);
    return this.http.get<StepFlowChecklistEquipment[]>(`${environment.apiUrl}/api/checklist/step-flow/orders/available-equipment`, { params })
      .pipe(map((equipment) => equipment.map((item) => ({ ...item, flowId: String(item.flowId), selected: false }))));
  }

  public replaceChecklistEquipment(orderId: number, flowIds: string[]): Observable<void> {
    return this.http.put<void>(`${environment.apiUrl}/api/checklist/step-flow/orders/${orderId}/equipment`, { flowIds });
  }
}
