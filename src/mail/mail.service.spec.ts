import { Test } from '@nestjs/testing';
import got from 'got';
import * as FormData from 'form-data';
import { CONFIG_OPTIONS } from 'src/common/common.constants';
import { MailService } from './mail.service';

jest.mock('form-data');
jest.mock('got');

const TEST_DOMAIN = 'test-domain'
const Options = {
  apiKey: 'test-apiKey',
  domain: TEST_DOMAIN,
  fromEmail: 'test-fromEmail',
}

describe('MailService', () => {
  let service: MailService;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MailService,          
        {
          provide: CONFIG_OPTIONS,
          useValue: Options
        }
      ]
    }).compile();
    service = module.get<MailService>(MailService);
  });
  it('Should be defined', () => {
    expect(service).toBeDefined();
  });
  describe('sendEmail', () => {
    const sendEmailArgs = {
      subject: 'subject',
      to: 'to',
      template: 'template',
      emailVars: [{ key: 'key', value: 'value'}],
    }
    it('send emails', async ()=> {
      const ok = await service.sendEmail('','','',[{ key: 'key', value: 'value'}]);
      const formSpy = jest.spyOn(FormData.prototype, 'append');
      expect(formSpy).toHaveBeenCalled();
      expect(got.post).toHaveBeenCalledTimes(1);
      expect(got.post).toHaveBeenCalledWith(
        `https://api.mailgun.net/v3/${TEST_DOMAIN}/messages`,
        expect.any(Object)
      );
      expect(ok).toEqual(true);
    });
    it('should fail on exption', async () => {
      jest.spyOn(got, 'post').mockImplementation(() => {
        throw new Error();
      });
      const ok = await service.sendEmail('','','',[{ key: 'key', value: 'value'}]);
      expect(ok).toEqual(false);
  })
  describe('sendVerificationEmail', () => {
    it('should call sendEmail', () => {
      const sendVerificationEmailArgs = {
        email: 'email',
        code: 'code',
        to: 'jungsuk.byun@gmail.com'
      };
      jest.spyOn(service, 'sendEmail').mockImplementation(async () => true);
      service.sendVerificationEmail(
        sendVerificationEmailArgs.email,
        sendVerificationEmailArgs.code,
      );
      expect(service.sendEmail).toHaveBeenCalledTimes(1);
      expect(service.sendEmail).toHaveBeenCalledWith(
        "Verify Your Email",
        sendVerificationEmailArgs.to,
        "verify-email",
        [
          {key:"code", value: sendVerificationEmailArgs.code},
          {key:"username", value: sendVerificationEmailArgs.email}
        ]
      );
    });
    })
  })
})