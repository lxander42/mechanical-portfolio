import { Routes } from '@angular/router';
import { AboutComponent } from './about/about.component';
import { ResumeComponent } from './resume/resume.component';
import { PortfolioComponent } from './portfolio/portfolio.component';
// import { WikiComponent } from './wiki/wiki.component';
import { ThreeModelComponent } from './three-model/three-model.component';

export const routes: Routes = [
  { path: 'about', component: AboutComponent },
  { path: 'resume', component: ResumeComponent },
  { path: 'portfolio', component: PortfolioComponent },
  // { path: 'wiki', component: WikiComponent },
  { path: 'threemodel', component: ThreeModelComponent },
  { path: '', redirectTo: '/threemodel', pathMatch: 'full' },  // Default route
];

