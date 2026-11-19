import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  RawMaterialCategory,
  RawMaterialFilters,
  RawMaterialHistory,
  RawMaterialDimensionField,
  RawMaterialPagedResult,
  RawMaterialSummary,
  RawMaterialsTable,
  RawMaterialUserAccess,
} from '../interface/raw-materials.interface';

@Injectable({ providedIn: 'root' })
export class RawMaterialsService {
  private readonly api = environment.apiUrl + '/api/raw-materials';

  constructor(private http: HttpClient) {}

  query(filters: RawMaterialFilters): Observable<RawMaterialPagedResult> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('size', filters.size)
      .set('inactive', Boolean(filters.inactive));
    const trimmedSearch = filters.search?.trim();
    if (trimmedSearch) params = params.set('search', trimmedSearch);
    if (filters.category) params = params.set('category', filters.category);
    if (filters.status && filters.status !== 'all') params = params.set('status', filters.status);
    if (filters.sortColumn) params = params.set('sort', `${filters.sortColumn},${filters.sortDirection ?? 'asc'}`);
    return this.http.get<RawMaterialPagedResult>(this.api, { params });
  }

  getSummary(): Observable<RawMaterialSummary> {
    return this.http.get<RawMaterialSummary>(`${this.api}/summary`);
  }

  getCategories(): Observable<RawMaterialCategory[]> {
    return this.http.get<RawMaterialCategory[]>(`${this.api}/categories`);
  }

  getUsers(): Observable<RawMaterialUserAccess[]> {
    return this.http.get<RawMaterialUserAccess[]>(`${this.api}/access`);
  }

  getMyCategoryIds(): Observable<number[]> {
    return this.http.get<number[]>(`${this.api}/access/me`);
  }

  findById(id: number): Observable<RawMaterialsTable> {
    return this.http.get<RawMaterialsTable>(`${this.api}/${id}`);
  }

  saveItem(item: RawMaterialsTable, activationReason?: string): Observable<RawMaterialsTable> {
    const body = {
      code: item.code,
      name: item.name,
      description: item.description ?? '',
      currentStorage: Number(item.currentStorage),
      minStorage: Number(item.minStorage),
      maxStorage: Number(item.maxStorage),
      length: this.optionalDecimal(item.length),
      width: this.optionalDecimal(item.width),
      thickness: this.optionalDecimal(item.thickness),
      height: this.optionalDecimal(item.height),
      weightPerSquareMeter: this.optionalDecimal(item.weightPerSquareMeter),
      litersPerUnit: this.optionalDecimal(item.litersPerUnit),
      weightPerLinearMeter: this.optionalDecimal(item.weightPerLinearMeter),
      categoryId: item.categoryId,
      active: item.active,
      activationReason,
    };
    return item.id
      ? this.http.put<RawMaterialsTable>(`${this.api}/${item.id}`, body)
      : this.http.post<RawMaterialsTable>(this.api, body);
  }

  updateStock(id: number, currentStorage: number, _currentStorageKg?: number, _user?: string): Observable<void> {
    return this.http.patch<void>(`${this.api}/${id}/stock`, { currentStorage });
  }

  addCategory(name: string, releaseToAll: boolean): Observable<RawMaterialCategory> {
    return this.http.post<RawMaterialCategory>(`${this.api}/categories`, { name, conversionFactor: null, releaseToAll });
  }

  updateCategory(id: number, name: string, conversionFactor: string | null, dimensionFields: RawMaterialDimensionField[]): Observable<RawMaterialCategory> {
    return this.http.put<RawMaterialCategory>(`${this.api}/categories/${id}`, { name, conversionFactor, dimensionFields, releaseToAll: true });
  }

  deleteCategory(id: number): Observable<boolean> {
    return this.http.delete<void>(`${this.api}/categories/${id}`).pipe(map(() => true));
  }

  updateUserAccess(users: RawMaterialUserAccess[]): Observable<void> {
    return this.http.put<void>(`${this.api}/access`, {
      users: users.map(user => ({ id: user.id, categoryIds: user.categoryIds })),
    });
  }

  getHistory(id: number, page: number, size: number): Observable<RawMaterialHistoryPage> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<RawMaterialHistoryPage>(`${this.api}/${id}/history`, { params });
  }

  getHistoryRetention(): Observable<{ value: number }> {
    return this.http.get<{ value: number }>(`${this.api}/settings/history-retention`);
  }

  updateHistoryRetention(value: number): Observable<{ value: number }> {
    return this.http.put<{ value: number }>(`${this.api}/settings/history-retention`, { value });
  }

  private decimal(value?: string | number): number {
    return Number(String(value ?? 0).replace(',', '.')) || 0;
  }

  private optionalDecimal(value?: string | number): number | null {
    const text = String(value ?? '').trim();
    return text ? this.decimal(text) : null;
  }
}

export interface RawMaterialHistoryPage {
  content: RawMaterialHistory[];
  totalElements: number;
  totalPages: number;
}
