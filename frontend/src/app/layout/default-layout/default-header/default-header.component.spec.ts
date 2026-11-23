import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import {
  AvatarModule,
  BadgeModule,
  BreadcrumbModule,
  ButtonGroupModule,
  DropdownModule,
  GridModule,
  HeaderModule,
  NavModule,
  ProgressModule,
  SidebarModule
} from '@coreui/angular';
import { IconModule, IconSetService } from '@coreui/icons-angular';
import { DefaultHeaderComponent } from './default-header.component';

describe('DefaultHeaderComponent', () => {
  let component: DefaultHeaderComponent;
  let fixture: ComponentFixture<DefaultHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [GridModule, HeaderModule, IconModule, NavModule, BadgeModule, AvatarModule, DropdownModule, BreadcrumbModule, SidebarModule, ProgressModule, ButtonGroupModule, ReactiveFormsModule, DefaultHeaderComponent],
    providers: [IconSetService, provideRouter([])]
})
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DefaultHeaderComponent);
    component = fixture.componentInstance;
    component.user = {
      id: 1,
      name: 'Usuário',
      email: 'usuario@example.com',
      position: null,
      birthDate: '2000-01-01',
      pictureId: null,
      activated: true,
      username: 'usuario',
      supportToken: null,
      roles: [],
      pendingIssues: []
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the complete checklist model hierarchy', () => {
    (component as any).updateChecklistBreadcrumbs('/qualidade/checklist/models/new');
    expect((component as any).checklistBreadcrumbs().map((item: { label: string }) => item.label))
      .toEqual(['Home', 'Checklist', 'Modelos', 'Novo modelo']);
  });

  it('shows the complete checklist editing hierarchy', () => {
    (component as any).updateChecklistBreadcrumbs('/qualidade/checklist/registro-1/edit');
    expect((component as any).checklistBreadcrumbs().map((item: { label: string }) => item.label))
      .toEqual(['Home', 'Checklist', 'Inspeção', 'Editar checklist']);
  });

  it('shows the complete memorando visualization hierarchy', () => {
    (component as any).updateChecklistBreadcrumbs('/general/memorando/1');
    expect((component as any).checklistBreadcrumbs().map((item: { label: string }) => item.label))
      .toEqual(['Home', 'Geral', 'Memorando', 'Visualização']);
  });
});
