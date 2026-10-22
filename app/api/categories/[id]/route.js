import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/mongodb';
import Category from '@/models/Category';
import { requireAdmin } from '@/lib/apiAuth';

function getFilter(id) {
  return mongoose.isValidObjectId(id) ? { _id: id } : { slug: id };
}

// GET /api/categories/[id]
// Returns:
//   category      — the category itself, with `parent` populated (name/slug)
//                   so the storefront can render a "back to main category"
//                   breadcrumb when viewing a subcategory
//   subcategories — direct children of this category (empty array if this
//                   category is itself a subcategory, or has none)
export async function GET(req, { params }) {
  await dbConnect();
  const category = await Category.findOne(getFilter(params.id)).populate('parent', 'name slug');
  if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

  const subcategories = await Category.find({ parent: category._id, isActive: true }).sort({ sortOrder: 1, name: 1 });

  return NextResponse.json({ category, subcategories });
}

// Refresh the cached homepage (and layout, so the navbar updates too)
function refreshStorefront() {
  revalidatePath('/');
  revalidatePath('/', 'layout');
}

export const PUT = requireAdmin(async (req, { params }) => {
  await dbConnect();
  const body = await req.json();
  if ('parent' in body) body.parent = body.parent || null;

  // A category without sizes never keeps a size list
  if ('hasSizes' in body) {
    body.hasSizes = body.hasSizes !== false;
    if (!body.hasSizes) body.sizes = [];
  }

  const category = await Category.findOneAndUpdate(getFilter(params.id), body, { new: true });
  if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  refreshStorefront();
  return NextResponse.json({ category });
});

export const DELETE = requireAdmin(async (req, { params }) => {
  await dbConnect();
  await Category.findOneAndDelete(getFilter(params.id));
  refreshStorefront();
  return NextResponse.json({ success: true });
});