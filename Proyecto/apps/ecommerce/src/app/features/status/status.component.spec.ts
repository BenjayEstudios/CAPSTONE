import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { environment } from "../../../environments/environment";
import { StatusComponent } from "./status.component";

describe("StatusComponent", () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [StatusComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it("muestra el backend conectado cuando /health-check responde", () => {
    const fixture = TestBed.createComponent(StatusComponent);
    http
      .expectOne(`${environment.apiUrl}/health-check`)
      .flush({ status: "ok", timestamp: "2026-01-01T00:00:00.000Z" });
    fixture.detectChanges();

    expect(fixture.componentInstance.state()).toBe("ok");
    expect(fixture.nativeElement.textContent).toContain("Backend conectado");
  });

  it("muestra el error cuando el backend no responde", () => {
    const fixture = TestBed.createComponent(StatusComponent);
    http
      .expectOne(`${environment.apiUrl}/health-check`)
      .flush(null, { status: 503, statusText: "Service Unavailable" });
    fixture.detectChanges();

    expect(fixture.componentInstance.state()).toBe("error");
    expect(fixture.nativeElement.textContent).toContain("No se pudo conectar al backend");
  });
});
