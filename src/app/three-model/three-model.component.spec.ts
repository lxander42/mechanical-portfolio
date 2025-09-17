import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThreeModelComponent } from './three-model.component';
import { PORTFOLIO_SECTIONS } from '../core/data/portfolio-sections';

describe('ThreeModelComponent', () => {
  let fixture: ComponentFixture<ThreeModelComponent>;
  let component: ThreeModelComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThreeModelComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ThreeModelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose the portfolio sections by default', () => {
    expect(component.sections).toEqual(PORTFOLIO_SECTIONS);
  });

  it('should emit when a section is activated', () => {
    const expectedSection = PORTFOLIO_SECTIONS[0];
    const observer = jasmine.createSpy('sectionActivated');

    component.sectionActivated.subscribe(observer);
    component.handleSectionActivated(expectedSection);

    expect(observer).toHaveBeenCalledWith(expectedSection);
  });
});
