import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';

@Component({
  selector: 'app-header',
  imports: [RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  features = [
    { icon: 'code', title: 'Automated Testing', description: 'Run JUnit tests automatically on student submissions' },
    { icon: 'assessment', title: 'Instant Feedback', description: 'Get immediate results and detailed test reports' },
    { icon: 'school', title: 'Educational', description: 'Designed for academic environments and learning' },
    { icon: 'cloud_upload', title: 'Easy Upload', description: 'Simple ZIP upload process for your projects' }
  ];

  technologies = ['Angular 20', 'Material 3', 'NestJS', 'AWS', 'Docker', 'PostgreSQL'];
}
