var express = require('express');
var glob = require('glob');

var favicon = require('serve-favicon');
var logger = require('morgan');
var moment = require('moment');
var truncate = require('truncate');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var compress = require('compression');
var methodOverride = require('method-override');
var mongoose = require('mongoose');
var validator = require('express-validator');
var uploadify = require('uploadify');
var session = require('express-session');
var flash = require('connect-flash');

module.exports = function(app, config) {
  var env = process.env.NODE_ENV || 'development';
  app.locals.ENV = env;
  app.locals.ENV_DEVELOPMENT = env == 'development';

  app.set('views', config.root + '/app/views');
  app.set('view engine', 'jade');

  app.use(session({
    secret: 'nodeblog',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
  }));
  app.use(flash());
  app.use(function (req, res, next) {
      res.locals.errors = req.flash('error');
      res.locals.infos = req.flash('info');
      next();
  });

  app.use(function (req, res, next) {
    app.locals.pageName = req.path;
    app.locals.moment = moment;
    next();
  });


  // app.use(favicon(config.root + '/public/img/favicon.ico'));
  app.use(logger('dev'));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({
    extended: true
  }));

  app.use(validator({
        errorFormatter: function(param, msg, value) {
            var namespace = param.split('.'),
                root = namespace.shift(),
                formParam = root;

            while(namespace.length) {
                formParam += '[' + namespace.shift() + ']';
            }
            
            return {
                param : formParam,
                msg   : msg,
                value : value
            };
        }
    }));

  app.use(cookieParser());
  app.use(compress());
  app.use(express.static(config.root + '/public'));
  app.use(methodOverride());


  //文件上传
  uploadify(app,{
    path:'/fileupload1',
    fileKey:'imageFile',
    multer:{ dest: 'public/uploads/image/' },
    callback:function(req){
      console.log("图片上传成功");
      return req.files
    }
  });
  uploadify(app,{
    path:'/fileupload2',
    fileKey:'voiceFile',
    multer:{ dest: 'public/uploads/voice/' },
    callback:function(req){
      console.log("音频上传成功");
      return req.files
    }
  });

  var controllers = glob.sync(config.root + '/app/controllers/**/*.js');
  controllers.forEach(function (controller) {
    require(controller)(app);
  });

  app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
  });

  if(app.get('env') === 'development'){
    app.use(function (err, req, res, next) {
      res.status(err.status || 500);
      res.render('admin/error', {
        message: err.message,
        error: err,
        title: 'error'
      });
    });
  }

  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('admin/error', {
      message: err.message,
      error: {},
      title: 'error'
    });
  });

};
