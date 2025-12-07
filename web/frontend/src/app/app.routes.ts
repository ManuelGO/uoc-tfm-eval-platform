import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/auth/login',
    pathMatch: 'full'
  },
  {
    path: 'auth/login',
    loadComponent: () => import('./auth/login/login').then(m => m.Login)
  },
  {
    path: 'auth/verify',
    loadComponent: () => import('./auth/verify-token/verify-token').then(m => m.VerifyToken)
  },
  {
    path: 'home',
    loadComponent: () => import('./dashboard/home/home').then(m => m.Home),
    canActivate: [authGuard]
  },
  {
    path: 'submissions/upload/:pitId',
    loadComponent: () => import('./submissions/upload/upload').then(m => m.Upload),
    canActivate: [authGuard]
  },
  {
    path: 'submissions/:id/status',
    loadComponent: () => import('./submissions/status/status').then(m => m.Status),
    canActivate: [authGuard]
  },
  {
    path: 'pits/attach',
    loadComponent: () => import('./pits/attach/attach').then(m => m.Attach),
    canActivate: [authGuard]
  },
  {
    path: 'pits',
    loadComponent: () => import('./pits/list/list').then(m => m.List),
    canActivate: [authGuard]
  },
  {
    path: '**',
    redirectTo: '/auth/login'
  }
];
