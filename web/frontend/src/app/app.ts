import { Component, signal } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Navbar } from './core/components/navbar/navbar';
import { Header } from './core/components/header/header';
import { Footer } from './core/components/footer/footer';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Header, Footer],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  isLandingPage = signal(false);

  constructor(private router: Router) {
    // Set initial value based on current URL
    this.updateLandingPageState(this.router.url);

    // Listen to navigation events to update state
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.updateLandingPageState(event.urlAfterRedirects);
      });
  }

  private updateLandingPageState(url: string): void {
    // Remove query params and fragments for comparison
    const path = url.split('?')[0].split('#')[0];
    this.isLandingPage.set(path === '/' || path === '');
  }
}
