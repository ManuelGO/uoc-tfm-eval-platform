import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SesService {
  private client: SESClient;
  private sender: string | undefined;

  constructor(private config: ConfigService) {
    this.client = new SESClient({
      region: this.config.get('SES_REGION'),
    });

    this.sender = this.config.get('SES_SENDER');
  }

  async sendLoginEmail(email: string, token: string) {
    const url = `${this.config.get('APP_URL')}/auth/verify?token=${token}`;

    const params = {
      Source: this.sender,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Data: 'Your login link — UOC TFM' },
        Body: {
          Html: {
            Data: `
            <p>Hello!</p>
              <p>Click the link below to log in:</p>
              <p><a href="${url}">${url}</a></p>
              <p>This link is valid for 24 hours.</p>
            `,
          },
        },
      },
    };

    await this.client.send(new SendEmailCommand(params));
  }
}
