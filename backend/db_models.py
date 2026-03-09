from sqlalchemy import Column, Integer, String, Float, JSON
from database import Base


class IngredientDB(Base):
    __tablename__ = "ingredients"

    id                   = Column(Integer, primary_key=True, index=True)
    name                 = Column(String,  nullable=False)
    cost                 = Column(Float,   nullable=False)
    transport_cost       = Column(Float,   nullable=False, default=0.0)
    dm                   = Column(Float,   nullable=False)
    nutrients            = Column(JSON,    default=dict)
    inventory_limit_tons = Column(Float,   nullable=False)


class RecipeDB(Base):
    __tablename__ = "recipes"

    id                    = Column(Integer, primary_key=True, index=True)
    name                  = Column(String,  nullable=False)
    demand_tons           = Column(Float,   nullable=False)
    constraints           = Column(JSON,    default=dict)
    process_yield_percent = Column(Float,   nullable=False, default=100.0)
    bag_size_kg           = Column(Float,   nullable=False, default=50.0)
    parent_id             = Column(Integer, nullable=True) # If null, this is the master recipe
    version_tag           = Column(String,  nullable=False, default="V1")
