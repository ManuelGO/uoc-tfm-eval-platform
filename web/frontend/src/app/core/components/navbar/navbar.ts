import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Api } from '../../services/api';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  private api = inject(Api);
  private router = inject(Router);

  get isAuthenticated(): boolean {
    return !!localStorage.getItem('authToken');
  }

  logout(): void {
    this.api.clearAuthToken();
    this.router.navigate(['/auth/login']);
  }
}
