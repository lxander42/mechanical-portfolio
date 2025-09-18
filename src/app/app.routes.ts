import { Routes } from '@angular/router';
import { AboutComponent } from './about/about.component';
import { LandingComponent } from './landing/landing.component';
import { ResumeComponent } from './resume/resume.component';
import { PortfolioComponent } from './portfolio/portfolio.component';
import { WikiComponent } from './wiki/wiki.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: LandingComponent },
  { path: 'about', component: AboutComponent },
  { path: 'resume', component: ResumeComponent },
  { path: 'portfolio', component: PortfolioComponent },
  { path: 'wiki', component: WikiComponent },
  { path: '**', redirectTo: '' }
];

