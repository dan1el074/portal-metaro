import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { SerialPlatesDomainService } from './serial-plates-domain.service';
import { SerialPlateRelocation, ErpOrder, PlateHistory, PlatePatch, PlateSettings, SerialPlate, SerialPlateCreateDraft, SerialPlatePage, SerialPlateQuery, SerialPlateReport } from '../interface/serial-plates.interface';

@Injectable({ providedIn: 'root' })
export class SerialPlatesService extends SerialPlatesDomainService {
  private readonly orders = new Map<string, ErpOrder>();
  private readonly api = environment.apiUrl + '/api/serial-plates';

  public constructor(private readonly http: HttpClient) {
    super();
  }

  public findAll(query: SerialPlateQuery): Observable<SerialPlatePage> {
    return this.http.get<SerialPlatePage>(this.api, { params: this.params(query) });
  }

  public summary(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(this.api + '/summary');
  }

  public findBySerial(serial: string): Observable<SerialPlate> {
    return this.http.get<SerialPlate>(`${this.api}/${serial}`);
  }

  public history(serial: string): Observable<PlateHistory[]> {
    return this.http.get<PlateHistory[]>(`${this.api}/${serial}/history`);
  }

  public create(draft: SerialPlateCreateDraft): Observable<SerialPlate[]> {
    return this.http.post<SerialPlate[]>(this.api, draft);
  }

  public update(records: SerialPlate[], patch: PlatePatch, batch: boolean, confirmRelocation = false): Observable<SerialPlate | SerialPlate[]> {
    const versions = Object.fromEntries(records.map(row => [row.serial, row.version]));
    return this.http.put<SerialPlate | SerialPlate[]>(this.api + (batch ? '/batch' : '/' + records[0].serial), { patch, fields: Object.keys(patch), versions, confirmRelocation });
  }

  public relocationImpact(records: SerialPlate[], patch: PlatePatch): Observable<SerialPlateRelocation[]> {
    return this.http.post<SerialPlateRelocation[]>(this.api + '/relocation-impact', {
      patch, fields: Object.keys(patch), versions: Object.fromEntries(records.map(row => [row.serial, row.version])),
    });
  }

  public selection(serials: string[]): Observable<SerialPlate[]> {
    return this.http.post<SerialPlate[]>(this.api + '/selection', { serials });
  }

  public range(anchor: string, target: string, query: SerialPlateQuery): Observable<SerialPlate[]> {
    return this.http.get<SerialPlate[]>(this.api + '/range', { params: this.params(query).set('anchor', anchor).set('target', target) });
  }

  public settings(): Observable<PlateSettings> {
    return this.http.get<PlateSettings>(this.api + '/settings');
  }

  public saveSettings(settings: PlateSettings): Observable<PlateSettings> {
    return this.http.put<PlateSettings>(this.api + '/settings', settings);
  }

  public searchOrder(order: string): Observable<ErpOrder> {
    return this.http.get<ErpOrder>(this.api + '/erp/orders/' + encodeURIComponent(order.trim())).pipe(tap(result => this.orders.set(order.trim(), result)));
  }

  public report(serials: string[]): Observable<SerialPlateReport> {
    return this.http.post<SerialPlateReport>(this.api + '/report', { serials });
  }

  public orderItems(order: string): ErpOrder['items'] {
    return this.orders.get(order.trim())?.items ?? [];
  }

  private params(query: SerialPlateQuery): HttpParams {
    return new HttpParams().set('page', query.page).set('size', query.size).set('search', query.search)
      .set('status', query.status).set('sort', `${query.sortColumn},${query.sortDirection}`);
  }
}
