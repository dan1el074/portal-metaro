import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { UserService } from '../services/user.service';
import { ToastrService } from '../services/toast.service';
import { Me } from '../interface/user.interface';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard {
  constructor(
    private userService: UserService,
    private router: Router,
    private toaster: ToastrService
  ) {}

  public canActivate(route: ActivatedRouteSnapshot): Observable<boolean> | boolean {
    const requiredRoles: string[] = route.data?.['roles'];
    return this.getUser().pipe(
      map((user) => {
        if (!requiredRoles || requiredRoles.length === 0) return true;

        const userRoles = user.roles.map((role) => role.authority);

        const hasRole = requiredRoles.some(role =>
          userRoles.includes(role)
        );

        if (!hasRole) {
          this.showError(403);
        }

        return hasRole;
      }),
      catchError(() => {
        this.showError(401);
        return of(false);
      })
    );
  }

  public getUser(): Observable<Me> {
    const currentUser = this.userService.getCurrentUser();

    if (currentUser) {
      return of(currentUser);
    }

    return this.userService.getUserData().pipe(
      tap((data) => {
        this.userService.setUser(data);
      }),
      catchError((err) => {
        this.showError(err.status);
        throw err;
      })
    );
  }

  public clearUser() {
    this.userService.clearUser();
  }

  private showError(status: number) {
    switch (status) {
      case 401:
        this.toaster.error('Sessão expirada!');
        this.clearUser();
        this.router.navigate(['/login']);
        break;
      case 403:
        this.toaster.error('Acesso negado!');
        this.router.navigate(['/home']);
        break;
      default:
        this.toaster.error('Erro ao se conectar ao servidor!');
        this.clearUser();
        this.router.navigate(['/login']);
        break;
    }
  }
}
