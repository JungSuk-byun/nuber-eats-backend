import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/users/entities/user.entity";
import { Like, Raw, Repository } from "typeorm";
import { AllCategoriesOutput } from "./dtos/all-categories.dto";
import { CategoryInput, CategoryOutput } from "./dtos/category.dto";
import { CreateDishInput, CreateDishOutput } from "./dtos/create-dish.dto";
import { CreateRestaurantInput, CreateRestaurantOutput } from "./dtos/create-restaurant.dto";
import { DeleteDishInput, DeleteDishOutput } from "./dtos/delete-dish.dto";
import { DeleteRestaurantInput, DeleteRestaurantOutput } from "./dtos/delete-restaurant.dto";
import { EditDishInput, EditDishOutput } from "./dtos/edit-dish.dto";
import { EditRestaurantInput, EditRestaurantOutput } from "./dtos/edit-restaurant.dto";
import { RestaurantInput, RestaurantOutput } from "./dtos/restaurant.dto";
import { RestaurantsInput, RestaurantsOutput } from "./dtos/restaurants.dto";
import { SearchRestaurantsInput, SearchRestaurantsOutput } from "./dtos/search-restaurant.dto";
import { Category } from "./entities/category.entity";
import { Dish } from "./entities/dish.entity";
import { Restaurant } from "./entities/restaurant.entity";
import { CategoryRepository } from "./repository/category.repository";

const ROWS = 10;

@Injectable()
export class RestaurantService {
  constructor(
    @InjectRepository(Restaurant) 
    private readonly restaurants: Repository<Restaurant>,
    @InjectRepository(Dish) 
    private readonly dishes: Repository<Dish>,
    private readonly categories: CategoryRepository,
    ) {}
  
  async createRestaurant(
    owner: User,
    createRestaurantInput: CreateRestaurantInput
    ): Promise<CreateRestaurantOutput> {
    try{
      const newRestaurant = this.restaurants.create(createRestaurantInput);
      newRestaurant.owner = owner;
      const category = await this.categories.getOrCreate(
        createRestaurantInput.categoryName
      );
      newRestaurant.category = category;
      await this.restaurants.save(newRestaurant);
      return { ok: true }; 
    } catch {
      return {
        ok: false,
        error: 'Could not create restaurant',
      };
    }
  }

  async editRestaurant(owner: User, editRestaurantInupt: EditRestaurantInput
    ): Promise<EditRestaurantOutput> {
    const restaurant =  await this.restaurants.findOne(
      editRestaurantInupt.restaurantId
    );
    try {
      if(!restaurant) {
        return {
          ok: false,
          error: 'Restaurant not Found'
        };
      }
      if(owner.id !== restaurant.ownerId) {
        return {
          ok: false,
          error: "You can't edit this restaurant because it's not yours"
        };
      }

      let category: Category = null;
      if (editRestaurantInupt.categoryName) {
        category = await this.categories.getOrCreate(
          editRestaurantInupt.categoryName
        );
      }
      await this.restaurants.save([
        {
          id: editRestaurantInupt.restaurantId,
          ...editRestaurantInupt,
          ...(category && { category })
        }
      ]);
      return { ok: true };
    } catch {
      return {
        ok: false,
        error: 'Could not edit Restaurant'
      };
    }
  }

  async deleteRestaurant(owner: User, {restaurantId}: DeleteRestaurantInput
    ): Promise<DeleteRestaurantOutput> {
      try {
        const restaurant = await this.restaurants.findOne(restaurantId);
        if(!restaurant) {
          return {
            ok: false,
            error: "Doesn't find a restaurant"
          };
        }
        if(owner.id !== restaurant.ownerId) {
          return {
            ok: false,
            error: "You can't edit this restaurant because it's not yours"
          };
        }
        await this.restaurants.delete(restaurantId);
        return { ok: true };
      } catch {
        return {
          ok: false,
          error: 'Could not delete Restaurant'
        };
      }
    }

  async allCategories(): Promise<AllCategoriesOutput> {
    try {
      const categories = await this.categories.find();
      return {
        ok: true,
        categories,
      };
    } catch {
      return {
        ok: false,
        error: 'Could not load categories',
      };
    }
  }

  countRestaurants(category: Category) {
    return this.restaurants.count({category});    
  }

  async findCategoryBySlug({ slug, page }: CategoryInput): Promise<CategoryOutput> {
    const category = await this.categories.findOne({ slug });
    try {
      if(!category) {
        return {
          ok: false,
          error: 'Catogory not found'
        };
      }
      const restaurants = await this.restaurants.find({
        where: {category},
        take: ROWS,
        order: {
          isPromoted: 'DESC',
        },
        skip: (page - 1) * ROWS,
      });
      const totalResults = await this.countRestaurants(category);
      return { 
        ok: true, 
        category,
        restaurants,
        totalResults,
        totalPages: Math.ceil(totalResults / ROWS)
      };
    } catch {
      return {
        ok: false,
        error: 'Could not load category'
      };
    }
  }

  async allRestaurants({ page }:RestaurantsInput): Promise<RestaurantsOutput> {
    try {
      const [restaurants, totalResults] = await this.restaurants.findAndCount({
        skip: (page - 1) * ROWS,
        order: { isPromoted: 'DESC' },
        take: ROWS,
      });
      return {
        ok: true,
        results: restaurants,
        totalPages: Math.ceil(totalResults / ROWS),
        totalResults,
      }
    } catch {
      return {
        ok: false,
        error: 'Could not load restaurants'
      };
    }
  }

  async findRestaurantById({restaurantId}:RestaurantInput): Promise<RestaurantOutput> {
    try {
      const restaurant = await this.restaurants.findOne(restaurantId, {
        relations: ['menu']
      });
      if (!restaurant) {
        return {
          ok: false,
          error: 'Restaurant not found',
        };
      }
      return {
        ok: true,
        restaurant,
      }
    } catch {
      return {
        ok: false,
        error: 'Could not load a restaurant'
      }
    }
  }

  async searchRestaurantsByName ({ query, page }: SearchRestaurantsInput): Promise<SearchRestaurantsOutput> {
    try {
      const [restaurants, totalResults] = await this.restaurants.findAndCount({
        where: {
          name: Raw(name => `${name} ILIKE '%${query}%'`)
        },
        skip: (page - 1) * ROWS,
        take: ROWS,
      });
      return {
        ok: true,
        results: restaurants,
        totalPages: Math.ceil(totalResults / ROWS),
        totalResults,
      }
    } catch {
      return {
        ok: false,
        error: 'Could not search for restaurants'
      }
    }
  }

  async createDish(owner: User, createDishInput: CreateDishInput): Promise<CreateDishOutput> {
    try {
      const restaurant = await this.restaurants.findOne(createDishInput.restaurantId);
      if(!restaurant) {
        return {
          ok: false,
          error: 'Restaurant not found',
        }
      }
      if(owner.id !== restaurant.ownerId ) {
        return {
          ok: false,
          error: 'It is not your restaurant'
        }
      }
      await this.dishes.save(this.dishes.create({...createDishInput , restaurant}));
      return {
        ok: true
      }
    } catch {
      return {
        ok: true,
        error: 'Could not create dish'
      }
    }
  }

  async checkDishOwner(ownerId: number, dishId: number) {
    const dish = await this.dishes.findOne(dishId, {
      relations: ['restaurant'],
    });
    if (!dish) {
      return {
        ok: false,
        error: 'Dish not found',
      };
    }
    if (dish.restaurant.ownerId !== ownerId) {
      return {
        ok: false,
        error: "You can't do that.",
      };
    }
  }

  async editDish(owner: User, editDishInput: EditDishInput): Promise<EditDishOutput> {
    try {
      this.checkDishOwner(owner.id, editDishInput.dishId);
      await this.dishes.save([
        {
          id: editDishInput.dishId,
          ...editDishInput,
        },
      ]);
      return {
        ok: true,
      };
    } catch {
      return {
        ok: false,
        error: 'Could not delete dish',
      };
    }
  }

  async deleteDish(owner: User, deleteDishInput: DeleteDishInput): Promise<DeleteDishOutput> {
    try {
      this.checkDishOwner(owner.id, deleteDishInput.dishId);
      await this.dishes.delete(deleteDishInput.dishId);        
      return {
        ok: true,
      };
    } catch {
      return {
        ok: false,
        error: 'Could not delete dish',
      };
    }
  }
}