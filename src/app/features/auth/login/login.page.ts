import { Component, inject, OnInit } from '@angular/core';
import {
  IonContent,
  IonItem,
  IonInput,
  IonButton,
  IonSpinner,
  IonText,
  IonIcon,
  ToastController,
} from '@ionic/angular/standalone';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NavController } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { logInOutline, storefrontOutline, personOutline, lockClosedOutline } from 'ionicons/icons';
import { AuthService } from '@core/services/auth.service';

addIcons({ logInOutline, storefrontOutline, personOutline, lockClosedOutline });

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [
    IonContent,
    IonItem,
    IonInput,
    IonButton,
    IonSpinner,
    IonText,
    IonIcon,
    ReactiveFormsModule,
    TranslateModule,
  ],
})
export class LoginPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly navCtrl = inject(NavController);
  private readonly toast = inject(ToastController);

  loading = false;
  errorMessage = '';

  form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  ngOnInit(): void {
    if (this.auth.isAuthenticated) {
      void this.navCtrl.navigateRoot('/pos', { animated: false });
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.loading) return;

    this.loading = true;
    this.errorMessage = '';

    this.auth.login(this.form.getRawValue()).subscribe({
      next: async () => {
        try {
          await this.navCtrl.navigateRoot('/pos', {
            animated: true,
            animationDirection: 'forward',
          });
        } finally {
          this.loading = false;
        }
      },
      error: async (err: { error?: { message?: string } }) => {
        this.loading = false;
        this.errorMessage = err.error?.message ?? 'Error de autenticación';
        const t = await this.toast.create({
          message: this.errorMessage,
          duration: 3000,
          color: 'danger',
        });
        await t.present();
      },
    });
  }
}
