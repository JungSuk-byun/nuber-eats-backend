import { Resolver, Query, Mutation, Args } from "@nestjs/graphql";
import { LoginInput, LoginOutput } from "src/common/dtos/login.dto";
import { CreateAccountInput, CreateAccountOutput } from "./dtos/createAccount.dto";
import { User } from "./entities/user.entity";
import { UserService } from "./users.service";

@Resolver(of => User)
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Query(returns => [User])
  getAllUsers(): Promise <User[]> {
    return this.userService.getAllUsers();
  }

  @Mutation(returns => CreateAccountOutput)
  async createAccount(
    @Args('input') createAccountInput: CreateAccountInput
    ): Promise<CreateAccountOutput> {
    try {
      const {ok, error} = await this.userService.createAccount(createAccountInput);
      return { ok, error };
    } catch(error) {
      return { ok: false, error };
    }
  }

  @Mutation(returns => LoginOutput)
  async login(@Args('input') loginInput: LoginInput): Promise<LoginOutput> {

  }
}
