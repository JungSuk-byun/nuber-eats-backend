import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LoginInput, LoginOutput } from "src/common/dtos/login.dto";
import { Repository } from "typeorm";
import { CreateAccountInput } from "./dtos/createAccount.dto";
import { User } from "./entities/user.entity";

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) 
    private readonly users: Repository<User>
  ) {}

  async createAccount({email, password, role}: CreateAccountInput): Promise<{ ok: boolean, error?: string }> {
    try {
      const exists = await this.users.findOne({ email });
      if (exists) {
        return {ok: false, error: 'There is a user with that email already'};
      }
      await this.users.save(this.users.create({ email, password, role }));
      return {ok: true};
    } catch(e) {      
      return {ok: false, error: "couldn't create account"};
    }
  }

  getAllUsers(): Promise<User[]> {
    return this.users.find();
  }

  async login({ email, password}: LoginInput): Promise<{ ok: boolean, error?: string, token?: string}> {
    try {
      const user = await this.users.findOne({ email });
      if (!user) {
        return { ok: false, error: 'User not found!'};
      }
      const passwordCorrect = await user.checkPassword(password);
      if (!passwordCorrect) {
        return { ok: false, error: 'Wrong Password!'};
      }
    } catch(error) {
      return { ok: false, error };
    }
  }
}