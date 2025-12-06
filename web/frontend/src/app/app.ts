import { Component } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { Navbar } from './core/components/navbar/navbar';
import { Header } from './core/components/header/header';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Header],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  constructor(private router: Router) {}

  get isLandingPage(): boolean {
    return this.router.url === '/' || this.router.url === '/auth/login';
  }
}
