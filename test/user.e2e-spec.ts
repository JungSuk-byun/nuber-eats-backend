import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { getConnection, Repository } from 'typeorm';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { updateArgument } from 'graphql-tools';
import { Verification } from 'src/users/entities/verification.entity';
import { string } from 'joi';

jest.mock('got', () => {
  return {
    post: jest.fn()
  };
});

const GRAPHQL_ENDPOINT = '/graphql';
const testUser = {
  email: 'testEmail',
  password: '12345'
}

describe('UserModule (e2e)', () => {
  let app: INestApplication;
  let usersRepository: Repository<User>;
  let verificationsRepository: Repository<Verification>;
  let jwtToken: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    usersRepository = module.get<Repository<User>>(getRepositoryToken(User));
    verificationsRepository = module.get<Repository<Verification>>(getRepositoryToken(Verification));
    await app.init();
  });

  afterAll(async () => {
    await getConnection().dropDatabase();
    app.close();
  })

  describe('createAccount', () => {
    it('should create account', () => {
      return request(app.getHttpServer())
      .post(GRAPHQL_ENDPOINT)
      .send({
        query: `
        mutation {
          createAccount(input: {
            email: "${testUser.email}",
            password: "${testUser.password}",
            role: Client
          }) {
            ok
            error
          }
        }
        `,
      })
      .expect(200)
      .expect(res => {
        const { body: {
            data: { 
              createAccount: {
                ok,
                error
              } 
            }
          }
        } = res;
        expect(ok).toBe(true);
        expect(error).toBe(null);
      });      
    });
    it('should fail if account already exists', () => {
      return request(app.getHttpServer())
      .post(GRAPHQL_ENDPOINT)
      .send({
        query: `
        mutation {
          createAccount(input: {
            email: "${testUser.email}",
            password: "${testUser.password}",
            role: Client
          }) {
            ok
            error
          }
        }
        `,
      })
      .expect(200)
      .expect(res => {
        const { body: {
          data: { 
            createAccount: {
              ok,
              error
            } 
          }
        }
      } = res;
        expect(ok).toBe(false);
        expect(error).toEqual(
          'There is a user with that email already'
        );
      });
    });
  });
  
  describe('login', () => {
    it('should log in if id and password are currect', () => {
      return request(app.getHttpServer())
      .post(GRAPHQL_ENDPOINT)
      .send({
        query:`
        mutation {
          login(input:{
            email: "${testUser.email}",
            password: "${testUser.password}",
          }) {
            ok
            error
            token
          }
        }
        `,
      })
      .expect(200)
      .expect(res => {
        const {
          body: {
            data: { 
              login: {
                ok,
                error,
                token
              }
            } 
          }
        } = res;
        expect(ok).toBe(true);
        expect(token).toEqual(expect.any(String));
        expect(error).toEqual('No error');
        jwtToken = token;
      });
    });
    it('should fail if id dose not exist', () => {
      return request(app.getHttpServer())
      .post(GRAPHQL_ENDPOINT)
      .send({
        query:`
        mutation {
          login(input:{
            email:"worngEmail"
            password: "${testUser.password}"
          }) {
            ok
            error
            token
          }
        }
        `,
      })
      .expect(200)
      .expect(res => {
        const {
            body: {
              data: { 
                login: {
                  ok,
                  error,
                  token
                }
              } 
            }
          } = res;
        expect(ok).toBe(false);
        expect(error).toEqual('User not found!');
        expect(token).toBe(null);
      });
    });
    it('should fail if password is diffrent', () => {
      return request(app.getHttpServer())
      .post(GRAPHQL_ENDPOINT)
      .send({
        query:`
        mutation {
          login(input:{
            email:"${testUser.email}"
            password: "worngPassword"
          }) {
            ok
            error
            token
          }
        }
        `,
      })
      .expect(200)
      .expect(res => {
        const {
          body: {
            data: { 
              login: {
                ok,
                error,
                token
              }
            } 
          }
        }= res;
        expect(ok).toBe(false);
        expect(error).toEqual('Wrong Password!');
        expect(token).toBe(null);
      });
    });
  });

  describe('userProfile', () => {
    let userId: number;
    beforeAll(async () => {
      const [user] = await usersRepository.find();
      userId = user.id;
    });

    it('should find a user if the user exists', () => {
      return request(app.getHttpServer())
      .post(GRAPHQL_ENDPOINT)
      .set("x-jwt", jwtToken)
      .send({
        query: `
        {
          userProfile(userId: ${userId}) {
            ok
            error
            user {
              id
            }           
          }
        }
        `,
      })
      .expect(200)
      .expect(res => {
        const { 
          body: {
            data: { 
              userProfile: {
                ok,
                error,
                user: { id }
              } 
            }
          }
        } = res;
        expect(ok).toBe(true);
        expect(error).toEqual(null);
        expect(id).toEqual(userId);
      });
    });
    it('should not found a user if the user dose not exist', () => {
      return request(app.getHttpServer())
      .post(GRAPHQL_ENDPOINT)
      .set("x-jwt", jwtToken)
      .send({
        query: `
        {
          userProfile(userId: 2) {
            ok
            error
            user {
              id
            }           
          }
        }
        `,
      })
      .expect(200)
      .expect(res => {
        const { 
          body: {
            data: { 
              userProfile: {
                ok,
                error,
                user
              } 
            }
          }
        } = res;
        expect(ok).toBe(false);
        expect(error).toEqual("User not found.");
        expect(user).toBe(null);
      });
    });
  });

  describe('me', () => {
    it('should find my profile', () => {
      return request(app.getHttpServer())
      .post(GRAPHQL_ENDPOINT)
      .set("x-jwt", jwtToken)
      .send({
        query: `
        {
          me {
            email
          }           
        }
        `,
      })
      .expect(200)
      .expect(res => {
        const { 
          body: {
            data: { 
              me: {email} 
            }
          }
        } = res;
        expect(email).toBe(testUser.email); 
      });
    });
    it('should not allow logged out user', () => {
      return request(app.getHttpServer())
      .post(GRAPHQL_ENDPOINT)
      .send({
        query: `
        {
          me {
            email
          }           
        }
        `,
      })
      .expect(200)
      .expect(res => {
        const {
          body: { errors }
        } = res;
        const [error] = errors;
        expect(error.message).toBe('Forbidden resource');
      });
    });
  });
  describe('editProfile', () => {
    const updateArgs = {
      email: 'updateEmail',
      password: '67890',
    }
    it('should update profile', () => {
      return request(app.getHttpServer())
      .post(GRAPHQL_ENDPOINT)
      .set("x-jwt", jwtToken)
      .send({
        query: `
          mutation {
          editProfile( input: {
            email: "${updateArgs.email}",
          }) {
            ok
            error
          }
        }`
      })
      .expect(200)
      .expect(res => {
        const { 
          body: {
            data: {
              editProfile: {
                ok,
                error
              }
            }
          }
        } = res;
        expect(ok).toBe(true);
        expect(error).toBe(null);
      });
    });  
    it('should have a new email', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .set("x-jwt", jwtToken)
        .send({
          query: `
          {
            me {
              email
            }           
          }
          `,
        })
        .expect(200)
        .expect(res => {
          const { 
            body: {
              data: { 
                me: {email} 
              }
            }
          } = res;
          expect(email).toBe(updateArgs.email); 
        });
    });
  });

  describe('verifyEmail', () => {
    let verificationCode; string;
    beforeAll( async () => {
      const [verification] = await verificationsRepository.find();
      verificationCode = verification.code;
    });
    it('should verify email', () => {
      return request(app.getHttpServer())
      .post(GRAPHQL_ENDPOINT)
      .send({
        query: `
          mutation {
            verifyEmail(input: {
              code: "${verificationCode}"
            }) {
              ok
              error
            }
          }
        `
      })
      .expect(200)
      .expect(res => {
        const {
          body: {
            data: {
              verifyEmail: {
                ok,
                error
              }
            }
          }
        } = res;
        expect(ok).toBe(true);
        expect(error).toBe(null);
      })
    });
    it('should fail on wrong code', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .send({
          query: `
            mutation {
              verifyEmail(input: {
                code: "xxx"
              }) {
                ok
                error
              }
            }
          `
        })
        .expect(200)
        .expect(res => {
          const {
            body: {
              data: {
                verifyEmail: {
                  ok,
                  error
                }
              }
            }
          } = res;
          expect(ok).toBe(false);
          expect(error).toEqual("Verification not found.");
        });
    });
  });
});
