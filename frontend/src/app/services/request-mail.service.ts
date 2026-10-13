import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { RequestMailConfig, RequestMailConfigUpdate } from '../interface/request-mail.interface';

@Injectable({ providedIn: 'root' })
export class RequestMailService {
  private readonly api = environment.apiUrl + '/api/request-access/config';

  constructor(private http: HttpClient) {}

  getConfig(): Observable<RequestMailConfig> {
    return this.http.get<RequestMailConfig>(this.api);
  }

  updateConfig(config: RequestMailConfigUpdate): Observable<RequestMailConfig> {
    return this.http.put<RequestMailConfig>(this.api, config);
  }
}
