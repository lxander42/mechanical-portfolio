import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThreeModelComponent } from './three-model.component';

describe('ThreeModelComponent', () => {
  let component: ThreeModelComponent;
  let fixture: ComponentFixture<ThreeModelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThreeModelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ThreeModelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
