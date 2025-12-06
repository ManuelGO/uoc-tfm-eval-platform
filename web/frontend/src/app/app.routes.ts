import { Routes } from '@angular/router';

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
    loadComponent: () => import('./dashboard/home/home').then(m => m.Home)
  },
  {
    path: 'submissions/upload/:pitId',
    loadComponent: () => import('./submissions/upload/upload').then(m => m.Upload)
  },
  {
    path: 'submissions/:id/status',
    loadComponent: () => import('./submissions/status/status').then(m => m.Status)
  },
  {
    path: 'pits/attach',
    loadComponent: () => import('./pits/attach/attach').then(m => m.Attach)
  },
  {
    path: 'pits',
    loadComponent: () => import('./pits/list/list').then(m => m.List)
  },
  {
    path: '**',
    redirectTo: '/auth/login'
  }
];
