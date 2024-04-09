const Product = require("../models/product");
const ErrorHandler = require("../utils/errorHandler");
const catchAsyncErrors = require("../middlewares/catchAsyncErrors");
const APIFeatures = require('../utils/apiFeatures')
const cloudinary = require('cloudinary')

// create new product  =>  /api/v1/admin/product/new
exports.newProduct = catchAsyncErrors(async (req, res, next) => {
  // console.log("Inside NewProduct");
  // for admin push images in cloudinary

  let images = []

  // console.log("Type  of", typeof(req.body.images));
    
    const string1 = JSON.stringify(req.body.images);

  console.log(typeof(string1));
  // if (typeof req.body.images === 'string') {
    if (typeof string1 === 'string') {

      images.push(req.body.images)  // for only one image
      // images.push(string1);
    } else {
      images = req.body.images 
    // if multiple images then else will be executed
  }
console.log("Images are : ",images);
  let imagesLinks = [];
  // console.log("1243");

  console.log("Img Length", images.length);
  for (let i = 0; i < images.length; i++) {
    console.log("Images : ",images[i].url);
    try {

      const result = await cloudinary.v2.uploader.upload(images[i].url, {
        folder: 'products'
      });
      // console.log("Result", result);
    
      imagesLinks.push({
          public_id: result.public_id,
          url: result.secure_url
      });
      // console.log("Image Links" , imagesLinks);
    } catch (error) {
      console.error("Error uploading image:", error);
    }
    
  }
  req.body.images = imagesLinks
  req.body.user = req.user.id;
  // console.log("Before Imagelink");
  // console.log("Before Imagelink 123456",req.body);
  const product = await Product.create(req.body);
  console.log("Prodcut",product);
  res.status(201).json({
    success: true,
    product,
  });
});

// Get all products   =>   /api/v1/products?keyword=apple
exports.getProducts = catchAsyncErrors(async (req, res, next) => {

  const resPerPage = 8;
  const productsCount = await Product.countDocuments();

  const apiFeatures = new APIFeatures(Product.find(), req.query).search().filter().pagination(resPerPage)

  let products = await apiFeatures.query;

  setTimeout(()=> {
    res.status(200).json({
      success: true,
      productsCount,
      resPerPage,
      products,
    });
  }, 500)
});


// Get all products (Admin)  =>   /api/v1/admin/products
exports.getAdminProducts = catchAsyncErrors(async (req, res, next) => {

  const products = await Product.find();

  res.status(200).json({
      success: true,
      products
  })

})


// Get single  product details  =>   /api/v1/product/:id
exports.getSingleProduct = catchAsyncErrors(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ErrorHandler("Product not found", 404));
  }

  res.status(200).json({
    success: true,
    product,
  });
});

// Update Product   =>   /api/v1/admin/product/:id
exports.updateProduct = catchAsyncErrors(async (req, res, next) => {
  let product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ErrorHandler("Product not found", 404));
  }

  
  let images = []
  if (typeof req.body.images === 'string') {
      images.push(req.body.images)
  } else {
      images = req.body.images
  }

  if (images !== undefined) {

      // Deleting images associated with the product
      for (let i = 0; i < product.images.length; i++) {
          const result = await cloudinary.v2.uploader.destroy(product.images[i].public_id)
      }

      let imagesLinks = [];

      for (let i = 0; i < images.length; i++) {
          const result = await cloudinary.v2.uploader.upload(images[i], {
              folder: 'products'
          });

          imagesLinks.push({
              public_id: result.public_id,
              url: result.secure_url
          })
      }

      req.body.images = imagesLinks

  }

  product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
    useFindAndModify: false,
  });

  res.status(200).json({
    success: true,
    product,
  });
});

// Delete Product   =>   /api/v1/admin/product/:id
exports.deleteProduct = catchAsyncErrors(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ErrorHandler("Product not found", 404));
  }

  // Deleting images associated with the product
  for(let i = 0; i < product.images.length; ++i) {
    const result = await cloudinary.v2.uploader.destroy(product.images[i].public_id);
  }

  await product.remove();

  res.status(200).json({
    success: true,
    message: "Product is deleted.",
  });
});



// Create new review   =>   /api/v1/review
exports.createProductReview = catchAsyncErrors(async (req, res, next) => {

  const { rating, comment, productId } = req.body;

  const review = {
      user: req.user._id,
      name: req.user.name,
      rating: Number(rating),
      comment
  }

  const product = await Product.findById(productId);

  const isReviewed = product.reviews.find(
      r => r.user.toString() === req.user._id.toString()
  )

  if (isReviewed) {
      product.reviews.forEach(review => {
          if (review.user.toString() === req.user._id.toString()) {
              review.comment = comment;
              review.rating = rating;
          }
      })

  } else {
      product.reviews.push(review);
      product.numOfReviews = product.reviews.length
  }

  product.ratings = product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length

  await product.save({ validateBeforeSave: false });

  res.status(200).json({
      success: true
  })

})

// Get Product Reviews   =>   /api/v1/reviews
exports.getProductReviews = catchAsyncErrors(async (req, res, next) => {
    const product = await Product.findById(req.query.id);

    res.status(200).json({
        success: true,
        reviews: product.reviews
    })
})


// Delete Product Review   =>   /api/v1/reviews
exports.deleteReview = catchAsyncErrors(async (req, res, next) => {

  const product = await Product.findById(req.query.productId);

  // console.log(product);

  const reviews = product.reviews.filter(review => review._id.toString() !== req.query.id.toString());

  const numOfReviews = reviews.length;

  const ratings = product.reviews.reduce((acc, item) => item.rating + acc, 0) / reviews.length

  await Product.findByIdAndUpdate(req.query.productId, {
      reviews,
      ratings,
      numOfReviews
  }, {
      new: true,
      runValidators: true,
      useFindAndModify: false
  })

  res.status(200).json({
      success: true
  })
})