var express = require('express'),
  router = express.Router(),
  mongoose = require('mongoose'),
  fs = require('fs');
  path = require("path");
  ScenicIntroduction = mongoose.model('ScenicIntroduction'),
  File = mongoose.model('File');
module.exports = function (app) {
  app.use('/admin/scenicIntroduction', router);
};

router.get('/', function (req, res, next) {
  var sortby = req.query.sortby?req.query.sortby:"created";
  var sortdir = req.query.sortdir?req.query.sortdir:"desc";

  if(['title','created','published','favorite','recommend'].indexOf(sortby)=== -1){
    sortby = 'created';
  }
  if(['desc','asc'].indexOf(sortdir)=== -1){
    sortdir = 'desc';
  }

  var sortObj = {};
  sortObj[sortby] = sortdir;
  
  ScenicIntroduction.find()
    .sort(sortObj)
    .populate('images')
    .populate('voices')
    .exec(function (err, scenics) {
      if (err) return next(err);

      var pageNum = Math.abs(parseInt(req.query.page || 1,10));
      var pageSize = 1000;
      var totalCount = scenics.length;
      var pageCount = Math.ceil(totalCount / pageSize);

      if(pageNum>pageCount){
        pageNum = pageCount;
      }

      res.render('admin/scenicIntroduction/index', {
        scenics: scenics.slice((pageNum-1)*pageSize,pageNum*pageSize),
        pageTitle:'景点列表',
        pageNum:pageNum,
        pageCount:pageCount,
        sortby:sortby,
        sortdir:sortdir,
        pretty: true
      });
    });
});

router.get('/add', function (req, res, next) {
  res.render('admin/scenicIntroduction/add', {
    pretty: true,
    pageTitle:'添加景点',
    scenicIntroduction: {}
  });
});

router.post('/add', function (req, res, next) {
  var request = req.body;

  //后端校验
  req.checkBody('title', '景点名称不能为空').notEmpty();
  req.checkBody('content', '内容简介不能为空').notEmpty();
  var errors = req.validationErrors();
  if (errors) {
    console.log(errors);
    return res.send({code:0,error:errors});
  }

    //保存文件信息
    File.insertMany(request.file, (err, fileArray)=>{
      if (err) {
        console.log('文件信息添加失败:', err);
        return res.send({code:0,msg:'文件信息添加失败'});
      } else {
        console.log('文件信息添加成功');

        //区分图片和语音
        var images = [];
        var voices = [];
        for(var i=0;i<fileArray.length;i++){
            if(fileArray[i].fieldname === 'imageFile'){
              images.push(new mongoose.Types.ObjectId(fileArray[i]._id));
            }
            if(fileArray[i].fieldname === 'voiceFile'){
              voices.push(new mongoose.Types.ObjectId(fileArray[i]._id));
            }
        }

        //保存文字信息
        var title = request.title.trim();
        var info = request.info;
        var content = request.content;
        var favorite = request.favorite;
        var published = request.published;
        var scenicIntroduction = new ScenicIntroduction({
          title: title,
          info:info,
          content: content,
          published: published,
          favorite: favorite,
          created: new Date(),
          images:images,
          voices:voices
        });
        scenicIntroduction.save(function (err, scenicIntroduction) {
          if (err) {
            console.log('文字信息添加失败:', err);
            return res.send({code:0,msg:'文字信息添加失败'});
          } else {
            console.log('文字信息添加成功');
            return res.send({code:1,msg:'文字信息添加成功'});
          }
        });
      }
    })
});

router.post('/delFile', function (req, res, next) {
  var filePath = req.body.path;

  //移除服务器路径下文件
  fs.unlink(filePath, function(err){
    if(err){
      console.log(err) ;
      return res.send({code:0,error:err});
    }else{
      console.log('文件删除成功') ;
      return res.send({code:1});
    }
  }) ;
});

router.get('/edit/:id', function (req, res, next) {
  if (!req.params.id) {
    return next(new Error('删除id不存在'));
  }

  var obj = {
    _id: new mongoose.Types.ObjectId(req.params.id)
  }

  ScenicIntroduction.find(obj)
    .populate('images')
    .populate('voices')
    .exec(function (err, scenics) {
      if (err) 
        return next(err);
      res.render('admin/scenicIntroduction/add', {
        pretty: true,
        pageTitle:'修改景点',
        scenicIntroduction: scenics[0]
      });
    });
});

router.post('/edit', function (req, res, next) {
  //关于图片文件的更新在delFile的接口中已经做了，所以这里不用更新了
  var request = req.body;
  var scenicId = request.id;//景点ID
  var file = request.file;//新添加的文章数组
  var oldDelImage = request.oldDelImage;//被移除的旧的图片ID字符串数组
  var oldDelImageObjId = [];//被移除的旧的图片objectID数组
  var newObj = request.obj;//修改后的景点
  
  for(var i=0;i<oldDelImage.length;i++){
    oldDelImageObjId.push(new mongoose.Types.ObjectId(oldDelImage[i]))
  }

  removeImage();
  
  //删除旧的图片
  function removeImage(){
    //如果存在被删除的图片
    if(oldDelImage.length>0){
      ScenicIntroduction.findById(scenicId)
        .populate('images')
        .populate('voices')
        .exec(function (err, scenic) {
          if(err){
            return res.send({code:0,error:"没有查到相应内容"})
          }
          //移除旧图片的关联
          var images = scenic.images;
          var newImageArray = [];
          for(var i=0;i<images.length;i++){
              if(oldDelImage.indexOf(images[i].id)<0){
                newImageArray.push(new mongoose.Types.ObjectId(images[i].id));
              }
          }
          if(newImageArray.length>0){
            newObj.images = newImageArray;
          }
          //删除旧图片记录
          console.log(oldDelImageObjId);
          File.find({"_id":{ $in: oldDelImageObjId}},function(err,delFile){
            if(err){
              return res.send({code:0,error:"获取文件信息出错"})
            }
            console.log(delFile);
            File.remove({"_id":{$in: oldDelImageObjId}},function(err,rowsRemoved){
              if(err){
                return res.send({code:0,error:"删除文件信息出错"})
              }
              console.log("成功删除文件信息:"+rowsRemoved);
              //移除目录中文件
              for(var i=0;i<delFile.length;i++){
                var filePath = delFile[i].destination+delFile[i].filename;
                fs.unlink(filePath, function(err){
                  if(err){
                    console.log(err) ;
                    return res.send({code:0,error:err});
                  }else{
                    console.log('文件删除成功') ;
                    addNewImage();
                  }
                }) ;
              }
            })
          });
        });
    }else{
      addNewImage()
    }
  }

  //添加新的图片
  function addNewImage(){
    //如果有新的文件
    if(file.length>0){
      File.insertMany(file, (err, fileArray)=>{
        if (err) {
          console.log('文件信息添加失败:', err);
          return res.send({code:0,msg:'文件信息添加失败'});
        } else {
          console.log('文件信息添加成功');
          var tempImage = [],tempVoice = [];
          for(var i=0;i<fileArray.length;i++){
            if(fileArray[i].fieldname === 'imageFile'){
              tempImage.push(new mongoose.Types.ObjectId(fileArray[i]._id));
            }
            else if(fileArray[i].fieldname === 'voiceFile'){
              tempVoice.push(new mongoose.Types.ObjectId(fileArray[i]._id));
            }
          }
          if(tempImage.length>0){
            if(newObj.images){
              newObj.images = newObj.images.concat(tempImage);//合并新图片和旧图片两个数组
            }else{
              newObj.images = tempImage;//只有新图片
            }
          }
          if(tempVoice.length>0){
            newObj.voices = tempVoice;
          }
          updateScenic();
        }
      })
    }else{
      updateScenic();
    }
  }

  //更新文章内容
  function updateScenic(){
    ScenicIntroduction.findByIdAndUpdate(scenicId,{$set:newObj},function(err,newScenic){
      if(err){
        return res.send({code:0,error:"更新文章失败"})
      }
      console.log('更新文章成功');
      return res.send({code:1});
    }); 
  }      
});


router.get('/delete/:id', function (req, res, next) {
  if (!req.params.id) {
    return next(new Error('删除id不存在'));
  }

  var conditions = {
    _id:new mongoose.Types.ObjectId(req.params.id)
  };

  ScenicIntroduction.remove(conditions).exec(function (err, rowsRemoved) {
    if (err) {
      return next(err);
    }

    if (rowsRemoved) {
      console.log('删除成功');
    } else {
      console.log('删除失败');
    }

    res.redirect('/admin/scenicIntroduction');
  });
});

router.get('/recommend/:id/:status', function (req, res, next) {
  if (!req.params.id||!req.params.status) {
    req.flash('error','缺少参数')
    res.redirect('/admin/scenicIntroduction');
  }

  ScenicIntroduction.count({recommend:true}, function(err,count){
    var newRecommend = {recommend:req.params.status==="true"?true:false};

    if(count+1>3&&newRecommend.recommend===true){
      req.flash('error','推荐景点最多为三个')
      res.redirect('/admin/scenicIntroduction');
      return;
    }

    ScenicIntroduction.findByIdAndUpdate(req.params.id,{$set:newRecommend},function(err,newScenic){
      if(err){
        return next(err);
      }
      console.log('更新推荐状态成功');
      res.redirect('/admin/scenicIntroduction');
    });
  });
});

router.get('/published/:id/:status', function (req, res, next) {
  if (!req.params.id||!req.params.status) {
    req.flash('error','缺少参数')
    res.redirect('/admin/scenicIntroduction');
  }

  var newPublished = {published:req.params.status==="true"?true:false};
  ScenicIntroduction.findByIdAndUpdate(req.params.id,{$set:newPublished},function(err,newScenic){
    if(err){
      return next(err);
    }
    console.log('更新推荐状态成功');
    res.redirect('/admin/scenicIntroduction');
  });
});
